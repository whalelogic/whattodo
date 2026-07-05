package llm

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

const basePrompt = `You are a Connecticut local guide.
Answer the user's request clearly and concisely. Based on the location, suggest relevant places, restaurants, and activities in Connecticut.
When you mention specific places, append one location tag per line at the very end using exactly this format:
[[LOC|name|address|maps_query]]
Rules:
- Keep location tags only at the end after the answer text.
- maps_query should be useful for Google Maps search.
- Include 0-5 tags depending on relevance.
- Do not include any extra text after the tags.`

type Location struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	MapsQuery string `json:"maps_query"`
	MapsURL   string `json:"maps_url"`
}

type StreamResult struct {
	CleanText string     `json:"text"`
	Locations []Location `json:"locations"`
}

var locTagRegex = regexp.MustCompile(`\[\[LOC\|(.+?)\|(.+?)\|(.+?)\]\]`)

func StreamGemini(
	ctx context.Context,
	apiKey, model, userMessage string,
) (<-chan string, <-chan StreamResult, <-chan error) {
	deltaCh := make(chan string)
	resultCh := make(chan StreamResult, 1)
	errCh := make(chan error, 1)

	go func() {
		defer close(deltaCh)
		defer close(resultCh)
		defer close(errCh)

		if strings.TrimSpace(apiKey) == "" {
			errCh <- errors.New("you should set GEMINI_API_KEY, and GEMINI_MODEL if you want")
			return
		}

		client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
		if err != nil {
			errCh <- err
			return
		}
		defer client.Close()

		gm := client.GenerativeModel(model)
		gm.SetTemperature(0.7)
		gm.SetTopP(0.95)
		gm.SetMaxOutputTokens(2048)
		gm.SystemInstruction = &genai.Content{
			Parts: []genai.Part{genai.Text(basePrompt)},
		}

		iter := gm.GenerateContentStream(ctx, genai.Text(userMessage))
		var raw strings.Builder

		for {
			resp, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				errCh <- err
				return
			}

			delta := responseText(resp)
			if delta == "" {
				continue
			}

			raw.WriteString(delta)
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			case deltaCh <- delta:
			}
		}

		cleanText, locations := extractLocations(raw.String())
		resultCh <- StreamResult{CleanText: cleanText, Locations: locations}
	}()

	return deltaCh, resultCh, errCh
}

func responseText(resp *genai.GenerateContentResponse) string {
	if resp == nil {
		return ""
	}
	var b strings.Builder
	for _, candidate := range resp.Candidates {
		if candidate == nil || candidate.Content == nil {
			continue
		}
		for _, part := range candidate.Content.Parts {
			textPart, ok := part.(genai.Text)
			if !ok {
				continue
			}
			b.WriteString(string(textPart))
		}
	}
	return b.String()
}

func extractLocations(raw string) (string, []Location) {
	matches := locTagRegex.FindAllStringSubmatch(raw, -1)
	locations := make([]Location, 0, len(matches))
	for _, m := range matches {
		if len(m) != 4 {
			continue
		}
		name := strings.TrimSpace(m[1])
		address := strings.TrimSpace(m[2])
		query := strings.TrimSpace(m[3])
		if query == "" {
			query = name + " " + address
		}
		locations = append(locations, Location{
			Name:      name,
			Address:   address,
			MapsQuery: query,
			MapsURL:   "https://www.google.com/maps/search/?api=1&query=" + url.QueryEscape(query),
		})
	}

	clean := locTagRegex.ReplaceAllString(raw, "")
	clean = strings.TrimSpace(clean)
	clean = strings.Trim(clean, "\n")
	return clean, dedupeLocations(locations)
}

func dedupeLocations(locs []Location) []Location {
	seen := make(map[string]struct{}, len(locs))
	out := make([]Location, 0, len(locs))
	for _, loc := range locs {
		key := strings.ToLower(loc.Name + "|" + loc.Address + "|" + loc.MapsQuery)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, loc)
	}
	return out
}
