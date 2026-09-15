package chart

import (
	"encoding/json"
	"fmt"
	"strings"
)

type ChartType string

const (
	TypeLine    ChartType = "line"
	TypeBar     ChartType = "bar"
	TypePie     ChartType = "pie"
	TypeScatter ChartType = "scatter"
	TypeHeatmap ChartType = "heatmap"
	TypeRadar   ChartType = "radar"
	TypeTable   ChartType = "table"
)

type ChartConfig struct {
	Type   ChartType      `json:"type"`
	Title  string         `json:"title"`
	Data   [][]float64    `json:"data"`
	Labels []string       `json:"labels"`
	Colors []string       `json:"colors,omitempty"`
	XLabel string         `json:"x_label,omitempty"`
	YLabel string         `json:"y_label,omitempty"`
}

func (c *ChartConfig) Validate() error {
	if c.Type == "" {
		return fmt.Errorf("chart type is required")
	}
	if len(c.Data) == 0 {
		return fmt.Errorf("chart data is required")
	}
	return nil
}

func (c *ChartConfig) ToJSX() string {
	switch c.Type {
	case TypeLine:
		return c.renderLine()
	case TypeBar:
		return c.renderBar()
	case TypePie:
		return c.renderPie()
	case TypeScatter:
		return c.renderScatter()
	case TypeHeatmap:
		return c.renderHeatmap()
	case TypeRadar:
		return c.renderRadar()
	default:
		return c.renderTable()
	}
}

func (c *ChartConfig) renderLine() string {
	return fmt.Sprintf(`
<LineChart width={600} height={400} data={%s}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="label" />
  <YAxis label={{ value: '%s', angle: -90, position: 'insideLeft' }} />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="value" stroke="#533afd" strokeWidth={2} dot={{ r: 4 }} />
</LineChart>`, renderLineData(c.Labels, c.Data[0]), c.YLabel)
}

func (c *ChartConfig) renderBar() string {
	return fmt.Sprintf(`
<BarChart width={600} height={400} data={%s}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="label" />
  <YAxis label={{ value: '%s', angle: -90, position: 'insideLeft' }} />
  <Tooltip />
  <Legend />
  <Bar dataKey="value" fill="#533afd" radius={[4, 4, 0, 0]} />
</BarChart>`, renderBarData(c.Labels, c.Data[0]), c.YLabel)
}

func (c *ChartConfig) renderPie() string {
	data := make([]map[string]interface{}, len(c.Labels))
	for i, label := range c.Labels {
		data[i] = map[string]interface{}{"name": label, "value": c.Data[0][i]}
	}
	return fmt.Sprintf(`
<PieChart width={600} height={400}>
  <Pie data={%s} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={150} label>
    {colors.map((color, i) => <Cell key={i} fill={color} />)}
  </Pie>
  <Tooltip />
  <Legend />
</PieChart>`, jsonString(data))
}

func (c *ChartConfig) renderScatter() string {
	points := make([]map[string]interface{}, len(c.Labels))
	for i, label := range c.Labels {
		points[i] = map[string]interface{}{"x": label, "y": c.Data[0][i]}
	}
	return fmt.Sprintf(`
<ScatterChart width={600} height={400}>
  <CartesianGrid />
  <XAxis type="number" dataKey="x" name="x" unit="" />
  <YAxis type="number" dataKey="y" name="y" unit="" />
  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
  <Scatter name="Data" data={%s} fill="#533afd" />
</ScatterChart>`, jsonString(points))
}

func (c *ChartConfig) renderHeatmap() string {
	return `<HeatmapChart width={600} height={400}><CartesianGrid /><XAxis dataKey="x" /><YAxis dataKey="y" /><Tooltip /><Cell data={%s} /></HeatmapChart>`
}

func (c *ChartConfig) renderRadar() string {
	data := make([]map[string]interface{}, len(c.Labels))
	for i, label := range c.Labels {
		data[i] = map[string]interface{}{"subject": label, "A": c.Data[0][i], "fullMark": 100}
	}
	return fmt.Sprintf(`
<RadarChart width={600} height={400} outerRadius={150} data={%s}>
  <PolarGrid />
  <PolarAngleAxis dataKey="subject" />
  <PolarRadiusAxis />
  <Radar name="Data" dataKey="A" stroke="#533afd" fill="#533afd" fillOpacity={0.6} />
</RadarChart>`, jsonString(data))
}

func (c *ChartConfig) renderTable() string {
	return `<TableChart data={%s} />`
}

func renderLineData(labels []string, values []float64) string {
	data := make([]map[string]interface{}, len(labels))
	for i, label := range labels {
		data[i] = map[string]interface{}{"label": label, "value": values[i]}
	}
	return jsonString(data)
}

func renderBarData(labels []string, values []float64) string {
	data := make([]map[string]interface{}, len(labels))
	for i, label := range labels {
		data[i] = map[string]interface{}{"label": label, "value": values[i]}
	}
	return jsonString(data)
}

func jsonString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func GetJSXComponent(chartType string) string {
	switch ChartType(chartType) {
	case TypeLine:
		return "LineChart"
	case TypeBar:
		return "BarChart"
	case TypePie:
		return "PieChart"
	case TypeScatter:
		return "ScatterChart"
	case TypeHeatmap:
		return "HeatmapChart"
	case TypeRadar:
		return "RadarChart"
	default:
		return "TableChart"
	}
}

func GetImportStatement(chartType string) string {
	component := GetJSXComponent(chartType)
	imports := []string{
		"LineChart", "Line", "CartesianGrid", "XAxis", "YAxis",
		"Tooltip", "Legend", "BarChart", "Bar", "PieChart", "Pie",
		"Cell", "ScatterChart", "Scatter", "RadarChart", "Radar",
		"PolarGrid", "PolarAngleAxis", "PolarRadiusAxis",
	}
	
	var sb strings.Builder
	sb.WriteString("import { ")
	for _, imp := range imports {
		if strings.Contains(imp, component) || component == "TableChart" {
			sb.WriteString(imp + ", ")
		}
	}
	sb.WriteString("} from 'recharts';")
	return sb.String()
}
