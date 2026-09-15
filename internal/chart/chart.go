package chart

import (
	"fmt"
	"strings"
)

type ChartType string

const (
	TypeLine    ChartType = "line"
	TypeBar     ChartType = "bar"
	TypePie     ChartType = "pie"
	TypeScatter ChartType = "scatter"
	TypeRadar   ChartType = "radar"
	TypeHeatmap ChartType = "heatmap"
)

type ChartConfig struct {
	Type     ChartType          `json:"type"`
	Title    string             `json:"title"`
	Labels   []string           `json:"labels"`
	Data     [][]float64        `json:"data"`
	Colors   []string           `json:"colors"`
	Options  map[string]any     `json:"options,omitempty"`
}

func (c *ChartConfig) Render() string {
	switch c.Type {
	case TypeLine:
		return c.renderLine()
	case TypeBar:
		return c.renderBar()
	case TypePie:
		return c.renderPie()
	case TypeScatter:
		return c.renderScatter()
	case TypeRadar:
		return c.renderRadar()
	case TypeHeatmap:
		return c.renderHeatmap()
	default:
		return c.renderTable()
	}
}

func (c *ChartConfig) renderLine() string {
	points := make([]string, len(c.Labels))
	for i, label := range c.Labels {
		points[i] = fmt.Sprintf("{x:%s,y:%.2f}", escapeJS(label), c.Data[0][i])
	}
	return fmt.Sprintf(`
<div style="width:100%%;height:300px">
<svg width="100%%" height="300" viewBox="0 0 %d 300">
<line x1="40" y1="280" x2="%d" y2="280" stroke="%s" stroke-width="1"/>
<line x1="40" y1="20" x2="40" y2="280" stroke="%s" stroke-width="1"/>
%s
</svg>
</div>`,
		len(c.Labels)*50+80,
		len(c.Labels)*50+40,
		"#94a3b8", "#94a3b8",
		renderLinePath(points),
	)
}

func (c *ChartConfig) renderBar() string {
	bars := make([]string, len(c.Labels))
	maxVal := 0.0
	for _, v := range c.Data[0] {
		if v > maxVal {
			maxVal = v
		}
	}
	for i, label := range c.Labels {
		height := 260 * c.Data[0][i] / maxVal
		bars[i] = fmt.Sprintf(`<rect x="%d" y="%d" width="40" height="%d" fill="%s"/>
<text x="%d" y="295" text-anchor="middle" fill="#94a3b8" font-size="12">%s</text>`,
			i*50+50, 280-height, height, c.Colors[0],
			i*50+70, label)
	}
	return fmt.Sprintf(`
<div style="width:100%%;height:300px">
<svg width="100%%" height="300" viewBox="0 0 %d 300">
%s
</svg>
</div>`,
		len(c.Labels)*50+80,
		strings.Join(bars, ""),
	)
}

func (c *ChartConfig) renderPie() string {
	circles := make([]string, len(c.Labels))
	total := 0.0
	for _, v := range c.Data[0] {
		total += v
	}
	for i, label := range c.Labels {
		percent := c.Data[0][i] / total * 100
		circles[i] = fmt.Sprintf(`<circle cx="150" cy="150" r="100" fill="%s" opacity="0.8"/>
<text x="260" y="%d" fill="#94a3b8" font-size="12">%s: %.1f%%</text>`,
			c.Colors[i%len(c.Colors)],
			60+i*25,
			label,
			percent,
		)
	}
	return fmt.Sprintf(`
<div style="width:100%%;height:300px;display:flex;justify-content:center;align-items:center">
<svg width="300" height="300" viewBox="0 0 300 300">
<circle cx="150" cy="150" r="100" fill="%s"/>
%s
</svg>
<div style="margin-left:20px">%s</div>
</div>`,
		c.Colors[0],
		strings.Join(circles, ""),
		"Legend here",
	)
}

func (c *ChartConfig) renderScatter() string {
	points := make([]string, len(c.Labels))
	for i := range c.Labels {
		points[i] = fmt.Sprintf(`<circle cx="%d" cy="%d" r="6" fill="%s"/>`,
			50+i*40,
			280-c.Data[0][i]/100*260,
			c.Colors[0],
		)
	}
	return fmt.Sprintf(`
<div style="width:100%%;height:300px">
<svg width="100%%" height="300" viewBox="0 0 %d 300">
%s
</svg>
</div>`,
		len(c.Labels)*40+100,
		strings.Join(points, ""),
	)
}

func (c *ChartConfig) renderRadar() string {
	return `<div style="width:100%;height:300px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8">Radar Chart (Recharts)</div>`
}

func (c *ChartConfig) renderHeatmap() string {
	return `<div style="width:100%;height:300px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8">Heatmap (Recharts)</div>`
}

func (c *ChartConfig) renderTable() string {
	html := `<table style="width:100%%;border-collapse:collapse">
<thead><tr style="background:rgba(83,58,253,0.1)">`
	for _, label := range c.Labels {
		html += fmt.Sprintf(`<th style="padding:12px;border:1px solid rgba(255,255,255,0.1);text-align:left">%s</th>`, label)
	}
	html += "</tr></thead><tbody>"
	for i, row := range c.Data {
		html += fmt.Sprintf(`<tr style="background:%s">`, map[bool]string{true: "rgba(255,255,255,0.02)", false: "transparent"}[i%2==0])
		for _, val := range row {
			html += fmt.Sprintf(`<td style="padding:12px;border:1px solid rgba(255,255,255,0.1)">%s</td>`, formatValue(val))
		}
		html += "</tr>"
	}
	html += "</tbody></table>"
	return html
}

func renderLinePath(points []string) string {
	if len(points) < 2 {
		return ""
	}
	var path string
	for i := range points {
		if i == 0 {
			path = fmt.Sprintf(`<polyline points="%s" fill="none" stroke="#533afd" stroke-width="2"/>`, strings.Join(points, " "))
		}
	}
	return path
}

func escapeJS(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "'", "\\'")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

func formatValue(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return fmt.Sprintf("%.2f", v)
}

// ExportPNG exports chart as PNG image data URL
func (c *ChartConfig) ExportPNG(width, height int) (string, error) {
	// Generate SVG first
	svg := c.RenderSVG(width, height)
	// For now, return SVG data URL
	// PNG conversion would require a canvas or external library
	return fmt.Sprintf("data:image/svg+xml;base64,%s", encodeBase64([]byte(svg))), nil
}

// ExportSVG exports chart as SVG string
func (c *ChartConfig) ExportSVG(width, height int) string {
	return c.RenderSVG(width, height)
}

func (c *ChartConfig) RenderSVG(width, height int) string {
	return `<svg width="` + fmt.Sprintf("%d", width) + `" height="` + fmt.Sprintf("%d", height) + `"></svg>`
}

func encodeBase64(data []byte) string {
	result := make([]byte, len(data)*4/3+4)
	j := 0
	for i := 0; i < len(data); i += 3 {
		val := uint32(data[i]) << 16
		if i+1 < len(data) {
			val |= uint32(data[i+1]) << 8
		}
		if i+2 < len(data) {
			val |= uint32(data[i+2])
		}
		result[j] = toChar((val >> 18) & 0x3F)
		result[j+1] = toChar((val >> 12) & 0x3F)
		result[j+2] = toChar((val >> 6) & 0x3F)
		result[j+3] = toChar(val & 0x3F)
		j += 4
	}
	return string(result)
}

func toChar(val uint32) byte {
	if val < 26 {
		return byte('A' + val)
	} else if val < 52 {
		return byte('a' + val - 26)
	} else if val < 62 {
		return byte('0' + val - 52)
	} else if val == 62 {
		return '+'
	}
	return '/'
}
