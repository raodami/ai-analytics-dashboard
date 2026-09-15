package export

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"
)

func ExportCSV(data []map[string]interface{}) (string, error) {
	if len(data) == 0 {
		return "", fmt.Errorf("no data to export")
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := make([]string, 0, len(data[0]))
	for k := range data[0] {
		headers = append(headers, k)
	}
	if err := writer.Write(headers); err != nil {
		return "", err
	}

	for _, row := range data {
		record := make([]string, len(headers))
		for i, h := range headers {
			val := row[h]
			if val == nil {
				record[i] = ""
			} else {
				record[i] = fmt.Sprintf("%v", val)
			}
		}
		if err := writer.Write(record); err != nil {
			return "", err
		}
	}

	writer.Flush()
	return buf.String(), nil
}

func ExportJSON(data []map[string]interface{}) (string, error) {
	if len(data) == 0 {
		return "[]", nil
	}

	var sb strings.Builder
	sb.WriteString("[\n")
	for i, row := range data {
		sb.WriteString("  {")
		first := true
		for k, v := range row {
			if !first {
				sb.WriteString(", ")
			}
			sb.WriteString(fmt.Sprintf("\"%s\": %v", k, v))
			first = false
		}
		sb.WriteString("}")
		if i < len(data)-1 {
			sb.WriteString(",")
		}
		sb.WriteString("\n")
	}
	sb.WriteString("]")

	return sb.String(), nil
}

func ExportMarkdown(data []map[string]interface{}) (string, error) {
	if len(data) == 0 {
		return "", fmt.Errorf("no data to export")
	}

	var sb strings.Builder

	headers := make([]string, 0, len(data[0]))
	for k := range data[0] {
		headers = append(headers, k)
	}

	sb.WriteString("| ")
	for i, h := range headers {
		if i > 0 {
			sb.WriteString(" | ")
		}
		sb.WriteString(h)
	}
	sb.WriteString(" |\n")

	sb.WriteString("|")
	for range headers {
		sb.WriteString(" --- |")
	}
	sb.WriteString("\n")

	for _, row := range data {
		sb.WriteString("| ")
		for i, h := range headers {
			if i > 0 {
				sb.WriteString(" | ")
			}
			val := row[h]
			if val == nil {
				sb.WriteString("")
			} else {
				sb.WriteString(fmt.Sprintf("%v", val))
			}
		}
		sb.WriteString(" |\n")
	}

	return sb.String(), nil
}
