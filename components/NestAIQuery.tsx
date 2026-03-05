import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface NestAIQueryProps {
  nests: any[];
  theme: 'light' | 'dark';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const NestAIQuery: React.FC<NestAIQueryProps> = ({ nests, theme }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<{ text?: string, chart?: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
You are an AI assistant for a sea turtle conservation portal. 
The user will ask a question about the nest records.
You are provided with the current nest data in JSON format.
If the user asks for a graph or chart, you MUST return a JSON object that describes the chart.
If the user asks a general question, you can return a JSON object with just a "text" field.

The JSON schema you must follow is:
{
  "text": "A textual response to the user's query (optional if chart is provided, but good for explanation)",
  "chart": {
    "type": "bar" | "line" | "pie",
    "data": [ { "name": "Category A", "value": 10 }, ... ],
    "xAxisKey": "name",
    "yAxisKey": "value",
    "title": "Chart Title"
  }
}

Only include the "chart" field if a chart is requested or makes sense for the data.
Here is the nest data:
${JSON.stringify(nests.map(n => ({
  id: n.id,
  status: n.status,
  species: n.species,
  eggs: n.eggs,
  location: n.location,
  date: n.date
})))}
`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              chart: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "bar, line, or pie" },
                  data: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        value: { type: Type.NUMBER }
                      }
                    }
                  },
                  xAxisKey: { type: Type.STRING },
                  yAxisKey: { type: Type.STRING },
                  title: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      let jsonStr = result.text;
      if (jsonStr) {
        // Strip out markdown code blocks if the model included them
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        setResponse(parsed);
      }
    } catch (err: any) {
      console.error("AI Query Error:", err);
      setError("Failed to process query. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chartConfig: any) => {
    if (!chartConfig || !chartConfig.data || chartConfig.data.length === 0) return null;

    const { type, data, xAxisKey, yAxisKey, title } = chartConfig;
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    return (
      <div className="w-full h-80 mt-6">
        {title && <h4 className={`text-center font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{title}</h4>}
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey={xAxisKey || 'name'} stroke={textColor} />
              <YAxis stroke={textColor} />
              <RechartsTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }} />
              <Legend />
              <Bar dataKey={yAxisKey || 'value'} fill="#3b82f6" />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey={xAxisKey || 'name'} stroke={textColor} />
              <YAxis stroke={textColor} />
              <RechartsTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }} />
              <Legend />
              <Line type="monotone" dataKey={yAxisKey || 'value'} stroke="#3b82f6" activeDot={{ r: 8 }} />
            </LineChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey={yAxisKey || 'value'}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }} />
              <Legend />
            </PieChart>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">Unsupported chart type</div>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className={`mt-8 p-6 rounded-xl border shadow-lg ${theme === 'dark' ? 'bg-[#1a232e] border-[#283039]' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <h3 className={`text-lg font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Ask AI about Nests
        </h3>
      </div>
      
      <form onSubmit={handleQuery} className="flex flex-col gap-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Show me a pie chart of nest statuses, or what is the average number of eggs?"
          rows={3}
          className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none font-medium transition-all shadow-sm resize-none ${
            theme === 'dark' 
              ? 'bg-[#111418] border-[#283039] text-slate-200 placeholder:text-slate-500' 
              : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'
          }`}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className={`self-end px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 ${(isLoading || !query.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
          ) : (
            <span className="material-symbols-outlined text-sm">send</span>
          )}
          Ask AI
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 text-sm font-medium">
          {error}
        </div>
      )}

      {response && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {response.text && (
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-[#111418] text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
              <p className="text-sm leading-relaxed">{response.text}</p>
            </div>
          )}
          {response.chart && renderChart(response.chart)}
        </div>
      )}
    </div>
  );
};
