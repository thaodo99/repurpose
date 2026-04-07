import { useState } from "react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs`;

const GOALS = [
  { id: "awareness", label: "Awareness" },
  { id: "leadgen", label: "Lead Gen" },
  { id: "thought_leadership", label: "Thought Leadership" },
  { id: "product_launch", label: "Product Launch" },
  { id: "hiring", label: "Hiring" },
  { id: "engagement", label: "Engagement" },
];

const AUDIENCES = [
  { id: "founders", label: "Founders" },
  { id: "pms", label: "Product Managers" },
  { id: "analysts", label: "Data Analysts" },
  { id: "recruiters", label: "Recruiters" },
  { id: "enterprise", label: "Enterprise Buyers" },
  { id: "general", label: "General Audience" },
];

const CTA_MODES = [
  { id: "soft", label: "Soft insight", desc: "Subtle. Invite reflection." },
  { id: "strong", label: "Strong CTA", desc: "Direct ask. DM, click, follow." },
  { id: "question", label: "Question-driven", desc: "Spark replies and comments." },
  { id: "authority", label: "Authority", desc: "Cement expertise. No hard sell." },
];

const EMOJI_OPTS = [
  { id: "none", label: "No emoji" },
  { id: "some", label: "Some (2–4)" },
  { id: "many", label: "Many" },
];

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", icon: "in", color: "#0077B5" },
  { id: "twitter", label: "Tweet Thread", icon: "𝕏", color: "#1a1a1a" },
  { id: "email", label: "Email Newsletter", icon: "✉", color: "#6B46C1" },
  { id: "instagram", label: "Instagram", icon: "IG", color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: "fb", color: "#1877F2" },
];

const WORD_LIMITS = {
  linkedin: { min: 50, max: 300, default: 150 },
  twitter: { min: 20, max: 120, default: 60, label: "per tweet" },
  email: { min: 80, max: 400, default: 200 },
  instagram: { min: 30, max: 200, default: 100 },
  facebook: { min: 50, max: 300, default: 150 },
};

const THEME_COLORS = {
  insight: "#1D9E75",
  stat: "#C9A84C",
  argument: "#378ADD",
  framework: "#7F77DD",
  quote: "#D4537E",
};

const EXAMPLE = `OpenAI just released GPT-4o, a new model that can reason across audio, vision, and text in real time. The demo showed it tutoring a student in math by watching them solve a problem on paper, then coaching them verbally — like a real human tutor. It can also detect emotions in voice, translate languages live, and sing. The model responds at near-human speed with no lag. This changes how we think about AI assistants — they're no longer just text tools. They're becoming multimodal collaborators.`;

async function extractTextFromPdf(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text;
}

function buildAnalysisPrompt(input) {
  return `Analyze this content and return ONLY valid JSON — no markdown, no backticks, no explanation:
{
  "wordCount": <integer count of words>,
  "themes": [
    {"type": "insight|stat|argument|framework|quote", "content": "<under 12 words>", "platform": "linkedin|twitter|email|all"}
  ],
  "hooks": {
    "curiosity": "<hook that makes reader desperately want to know more, under 15 words>",
    "stat": "<hook that leads with a surprising statistic or number, under 15 words>",
    "contrarian": "<hook that challenges conventional wisdom, under 15 words>"
  }
}
Rules:
- themes: 5-9 items total
- hooks: punchy, specific, avoid generic phrasing
Content:
${input}`;
}

function buildGenerationPrompt(platformId, settings, input) {
  const { goal, audience, ctaMode, storySlider, emoji, titles, wordLimit } = settings;

  const goalMap = {
    awareness: "Brand awareness - make the insight memorable and shareable. No selling.",
    leadgen: "Lead generation - create curiosity around a solution. End with a clear invitation.",
    thought_leadership: "Thought leadership - share a bold opinion or original framework.",
    product_launch: "Product launch - build excitement. Focus on transformation, not features.",
    hiring: "Hiring - showcase team culture, values, and what makes this opportunity special.",
    engagement: "Community engagement - spark discussion. Be provocative or emotionally resonant.",
  };

  const audienceMap = {
    founders: "Audience: founders and entrepreneurs. Speak to scale, risk, and growth decisions.",
    pms: "Audience: product managers. Speak to trade-offs, user empathy, and shipping.",
    analysts: "Audience: data analysts. Speak to evidence, metrics, and structured thinking.",
    recruiters: "Audience: recruiters and talent leaders. Speak to people, process, and culture.",
    enterprise: "Audience: enterprise buyers and executives. Speak to ROI and strategic outcomes.",
    general: "Audience: general professional audience. Keep it clear and broadly relatable.",
  };

  const ctaMap = {
    soft: "CTA style: Soft - end with a gentle reflection. No explicit ask.",
    strong: "CTA style: Strong - a specific, direct call to action.",
    question: "CTA style: Question-driven - close with a thought-provoking question.",
    authority: "CTA style: Authority positioning - a confident closing statement.",
  };

  const storyLabel =
    storySlider <= 20 ? "purely analytical - logic, data, structured argument"
    : storySlider <= 45 ? "analytical with narrative texture"
    : storySlider <= 65 ? "balanced analytical and narrative"
    : storySlider <= 85 ? "narrative-first with analytical grounding"
    : "pure storytelling - scene, tension, resolution";

  const emojiMap = {
    none: "No emoji whatsoever.",
    some: "2-4 emoji sparingly.",
    many: "Emoji generously - as bullets, section markers, and emphasis.",
  };

  const wordNote = {
    linkedin: `Max ${wordLimit} words total.`,
    twitter: `Each tweet max ${wordLimit} words. 5-7 tweets numbered (1/, 2/, ...). Blank line between each.`,
    email: `Body max ${wordLimit} words. Must include Subject: label and CTA: label.`,
    instagram: `Max ${wordLimit} words. Short punchy lines. 5-10 hashtags at the bottom.`,
    facebook: `Max ${wordLimit} words total. End with a question to drive comments.`,
  };

  const platformBase = {
    linkedin: "LinkedIn post. Strong hook in line 1. 3-5 relevant hashtags at the bottom.",
    twitter: "Twitter/X thread. First tweet = hook. Last tweet = CTA or summary.",
    email: "Email newsletter snippet: Subject: label, engaging opening, 2-3 body paragraphs, CTA: label.",
    instagram: "Instagram caption. Hook in line 1. Heavy line breaks. Punchy and visual.",
    facebook: "Facebook post. Conversational and warm. Tell a story or share an opinion.",
  };

  return `You are a senior marketing strategist and expert copywriter.

Source content:
${input}

Platform: ${platformBase[platformId]}
${wordNote[platformId]}
Goal: ${goalMap[goal]}
${audienceMap[audience]}
${ctaMap[ctaMode]}
Writing mode: ${storyLabel}
Emoji: ${emojiMap[emoji]}
Headers: ${titles ? "Add bold section headers." : "No titles or headers."}

Return your response in EXACTLY this format:
[POST]
<the finished post>
[WHY]
<one sentence, max 20 words, explaining why this works for this platform, goal, and audience>`;
}

export default function App() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [goal, setGoal] = useState("awareness");
  const [audience, setAudience] = useState("founders");
  const [ctaMode, setCtaMode] = useState("soft");
  const [storySlider, setStorySlider] = useState(50);
  const [emoji, setEmoji] = useState("some");
  const [titles, setTitles] = useState(false);
  const [wordLimits, setWordLimits] = useState({
    linkedin: WORD_LIMITS.linkedin.default,
    twitter: WORD_LIMITS.twitter.default,
    email: WORD_LIMITS.email.default,
    instagram: WORD_LIMITS.instagram.default,
    facebook: WORD_LIMITS.facebook.default,
  });
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [copiedHook, setCopiedHook] = useState(null);
  const [copiedPlatform, setCopiedPlatform] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [fileStatus, setFileStatus] = useState("");

  const handleFileUpload = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    setFileStatus("Reading file...");
    try {
      let text = "";
      if (ext === "txt") {
        text = await file.text();
      } else if (ext === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        text = await extractTextFromPdf(arrayBuffer);
      } else {
        setFileStatus("Unsupported file type. Use .txt, .pdf, or .docx");
        return;
      }
      if (!text.trim()) {
        setFileStatus("Could not extract text from file.");
        return;
      }
      setInput(text);
      setAnalysis(null);
      setResults({});
      setFileStatus("Loaded: " + file.name + " (" + text.trim().split(/\s+/).length + " words)");
    } catch (err) {
      setFileStatus("Error reading file: " + err.message);
    }
  };

  const handleUrlFetch = async () => {
    const url = urlInput.trim();
    if (!url) return;
  
    if (url.includes("drive.google.com/file")) {
      alert("Google Drive PDFs can't be fetched. Please download and upload the file instead.");
      return;
    }
  
    setUrlLoading(true);
    try {
      let text = "";
  
      if (url.includes("docs.google.com/document")) {
        const docId = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)?.[1];
        if (!docId) throw new Error("Could not extract document ID from URL");
        const exportUrl = "https://docs.google.com/document/d/" + docId + "/export?format=txt";
        const res = await fetch(exportUrl);
        if (!res.ok) throw new Error("Could not fetch. Make sure sharing is set to Anyone with the link can view");
        text = await res.text();
      } else {
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Could not fetch the page. It may be paywalled or private.");
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        ["script", "style", "nav", "header", "footer", "aside", "iframe", "noscript"].forEach(tag => {
          doc.querySelectorAll(tag).forEach(el => el.remove());
        });
        const article = doc.querySelector("article") || doc.querySelector("main") || doc.body;
        text = article.innerText || article.textContent || "";
        text = text.replace(/\s+/g, " ").trim();
      }
  
      if (!text.trim()) throw new Error("Could not extract text from this page.");
      setInput(text);
      setAnalysis(null);
      setResults({});
      setUrlInput("");
      setFileStatus("Loaded from URL (" + text.trim().split(/\s+/).length + " words)");
    } catch (err) {
      alert(err.message);
    }
    setUrlLoading(false);
  };

  const callClaude = async (prompt, maxTokens = 900) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "";
  };

  const analyzeContent = async () => {
    if (!input.trim()) return;
    setAnalysisLoading(true);
    setAnalysis(null);
    try {
      const raw = await callClaude(buildAnalysisPrompt(input), 700);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      setAnalysis(JSON.parse(cleaned));
    } catch {
      setAnalysis({ error: true });
    }
    setAnalysisLoading(false);
  };

  const repurpose = async () => {
    if (!input.trim()) return;
    setResults({});
    const initLoad = {};
    PLATFORMS.forEach((p) => (initLoad[p.id] = true));
    setLoading(initLoad);
    const settings = { goal, audience, ctaMode, storySlider, emoji, titles };
    await Promise.all(
      PLATFORMS.map(async (platform) => {
        try {
          const raw = await callClaude(
            buildGenerationPrompt(platform.id, { ...settings, wordLimit: wordLimits[platform.id] }, input)
          );
          const parts = raw.split("[WHY]");
          const post = parts[0].replace("[POST]", "").trim();
          const why = parts[1]?.trim() || "";
          setResults((prev) => ({ ...prev, [platform.id]: { post, why } }));
        } catch {
          setResults((prev) => ({ ...prev, [platform.id]: { post: "Error generating content.", why: "" } }));
        } finally {
          setLoading((prev) => ({ ...prev, [platform.id]: false }));
        }
      })
    );
  };

  const copyHook = (key, text) => { navigator.clipboard.writeText(text); setCopiedHook(key); setTimeout(() => setCopiedHook(null), 2000); };
  const copyPlatform = (id, text) => { navigator.clipboard.writeText(text); setCopiedPlatform(id); setTimeout(() => setCopiedPlatform(null), 2000); };

  const anyLoading = Object.values(loading).some(Boolean);
  const hasResults = Object.keys(results).length > 0;
  const storyLabel = storySlider <= 20 ? "Data-driven" : storySlider <= 45 ? "Analytical" : storySlider <= 65 ? "Balanced" : storySlider <= 85 ? "Narrative" : "Full story";

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "#0D0D0D", color: "#F0EDE6" }}>
      <style>{`
        @keyframes pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;outline:none;cursor:pointer;width:100%;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#C9A84C;cursor:pointer;}
        input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#C9A84C;cursor:pointer;border:none;}
        .pill-btn{transition:all 0.12s;}
        .pill-btn:hover{border-color:#555 !important;color:#999 !important;}
      `}</style>

      <div style={{ borderBottom: "1px solid #1A1A1A", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.5px" }}>Repurpose</span>
          <span style={{ fontSize: 10, color: "#3A3A3A", fontFamily: "monospace", letterSpacing: "0.12em" }}>MARKETING INTELLIGENCE ENGINE</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["01 Analyze", !!analysis], ["02 Configure", true], ["03 Generate", hasResults]].map(([s, done]) => (
            <span key={s} style={{ fontSize: 10, fontFamily: "sans-serif", padding: "3px 10px", borderRadius: 20, border: "1px solid " + (done ? "#C9A84C44" : "#1E1E1E"), color: done ? "#C9A84C" : "#2E2E2E" }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 32px 60px" }}>

        <SectionHeader num="01" title="Source Content" />
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#444", fontFamily: "sans-serif" }}>Paste any article, transcript, or notes</span>
            <button onClick={() => { setInput(EXAMPLE); setAnalysis(null); setResults({}); setFileStatus(""); }} style={{ fontSize: 12, color: "#C9A84C", background: "none", border: "none", cursor: "pointer", fontFamily: "sans-serif", padding: 0 }}>Load example</button>
          </div>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setAnalysis(null); setResults({}); setFileStatus(""); }}
            placeholder="Paste content here..."
            style={{ width: "100%", minHeight: 130, background: "#141414", border: "1px solid #222", borderRadius: 8, padding: "14px 18px", color: "#F0EDE6", fontSize: 15, lineHeight: 1.7, fontFamily: "'Georgia', serif", resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 12, color: "#666", border: "1px solid #222", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontFamily: "sans-serif", background: "#141414", whiteSpace: "nowrap" }}>
              Upload .txt / .pdf / .docx
              <input type="file" accept=".txt,.pdf,.docx" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }} />
            </label>
            {fileStatus && (
              <span style={{ fontSize: 11, color: fileStatus.startsWith("Error") || fileStatus.startsWith("Unsupported") || fileStatus.startsWith("Could") ? "#D4537E" : "#1D9E75", fontFamily: "sans-serif" }}>
                {fileStatus.startsWith("Error") || fileStatus.startsWith("Unsupported") || fileStatus.startsWith("Could") ? fileStatus : "✓ " + fileStatus}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
              placeholder="Paste any URL — article, Google Docs, Forbes, BBC..."
              style={{ flex: 1, background: "#141414", border: "1px solid #222", borderRadius: 6, padding: "7px 14px", color: "#F0EDE6", fontSize: 12, fontFamily: "sans-serif", outline: "none" }}
            />
            <button
              onClick={handleUrlFetch}
              disabled={!urlInput.trim() || urlLoading}
              style={{ fontSize: 12, color: urlInput.trim() && !urlLoading ? "#C9A84C" : "#333", border: "1px solid " + (urlInput.trim() ? "#C9A84C44" : "#222"), borderRadius: 6, padding: "7px 16px", background: "transparent", cursor: urlInput.trim() && !urlLoading ? "pointer" : "not-allowed", fontFamily: "sans-serif", whiteSpace: "nowrap" }}
            >
              {urlLoading ? "Fetching..." : "Fetch"}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              onClick={analyzeContent}
              disabled={!input.trim() || analysisLoading}
              style={{ color: input.trim() && !analysisLoading ? "#1D9E75" : "#2A2A2A", border: "1px solid " + (input.trim() && !analysisLoading ? "#1D9E75" : "#222"), background: "transparent", borderRadius: 6, padding: "9px 22px", fontSize: 13, fontWeight: 600, fontFamily: "sans-serif", cursor: input.trim() && !analysisLoading ? "pointer" : "not-allowed", letterSpacing: "0.03em" }}
            >
              {analysisLoading ? "Analyzing..." : "Analyze Content"}
            </button>
          </div>
        </div>

        {(analysis || analysisLoading) && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <SectionHeader num="02" title="Content Intelligence" accent="#1D9E75" />
            <div style={{ marginBottom: 28 }}>
              {analysisLoading ? (
                <div style={{ display: "flex", gap: 6, padding: "20px 0" }}>{[0,1,2].map(i => <Dot key={i} i={i} color="#1D9E75" />)}</div>
              ) : analysis && !analysis.error ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "Source words", value: analysis.wordCount },
                      { label: "Ideas extracted", value: analysis.themes?.length ?? 0 },
                      { label: "Hook variants", value: 3 },
                      { label: "Platforms ready", value: 5 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: "#0B1A14", border: "1px solid #0F2B1E", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 11, color: "#1D9E7580", fontFamily: "sans-serif", marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "#1D9E75" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <p style={sectionLabel}>Hook Variants</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { key: "curiosity", label: "Curiosity hook", color: "#7F77DD" },
                      { key: "stat", label: "Stat-led hook", color: "#C9A84C" },
                      { key: "contrarian", label: "Contrarian hook", color: "#D4537E" },
                    ].map(({ key, label, color }) => (
                      <div key={key} style={{ background: "#141414", border: "1px solid " + color + "25", borderRadius: 8, padding: "12px 14px", position: "relative" }}>
                        <div style={{ fontSize: 10, color, fontFamily: "sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "#B8B4AC", fontFamily: "'Georgia', serif" }}>"{analysis.hooks?.[key]}"</p>
                        <button onClick={() => copyHook(key, analysis.hooks?.[key])} style={{ position: "absolute", top: 10, right: 10, fontSize: 10, color: copiedHook === key ? "#6ECC8E" : "#333", background: "none", border: "none", cursor: "pointer", fontFamily: "sans-serif" }}>
                          {copiedHook === key ? "done" : "copy"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p style={sectionLabel}>Content Reuse Map</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {analysis.themes?.map((theme, i) => {
                      const color = THEME_COLORS[theme.type] || "#666";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, background: color + "0D", border: "1px solid " + color + "28", borderRadius: 6, padding: "6px 10px", maxWidth: 300 }}>
                          <span style={{ fontSize: 9, color, background: color + "1A", padding: "2px 6px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 1, fontFamily: "sans-serif" }}>{theme.type}</span>
                          <span style={{ fontSize: 12, fontFamily: "sans-serif", color: "#777", lineHeight: 1.4 }}>{theme.content}</span>
                          {theme.platform && theme.platform !== "all" && (
                            <span style={{ fontSize: 9, color: "#333", fontFamily: "monospace", marginLeft: "auto", flexShrink: 0, alignSelf: "center" }}>to {theme.platform}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#555", fontFamily: "sans-serif" }}>Analysis failed — please try again.</p>
              )}
            </div>
          </div>
        )}

        <SectionHeader num="03" title="Strategy Configuration" />
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <PillSelector label="Campaign Goal" options={GOALS} value={goal} onChange={setGoal} />
            <PillSelector label="Target Audience" options={AUDIENCES} value={audience} onChange={setAudience} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <p style={sectionLabel}>CTA Mode</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {CTA_MODES.map((c) => (
                <button key={c.id} onClick={() => setCtaMode(c.id)} style={{ textAlign: "left", background: ctaMode === c.id ? "#1C1608" : "#141414", border: ctaMode === c.id ? "1px solid #C9A84C" : "1px solid #1E1E1E", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "sans-serif", color: ctaMode === c.id ? "#C9A84C" : "#666", display: "block" }}>{c.label}</span>
                  <span style={{ fontSize: 11, fontFamily: "sans-serif", color: ctaMode === c.id ? "#7A6030" : "#333", display: "block", marginTop: 3, lineHeight: 1.4 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, padding: "14px 18px" }}>
              <p style={sectionLabel}>Writing Mode</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#444", fontFamily: "sans-serif" }}>Analytical</span>
                <span style={{ fontSize: 11, color: "#C9A84C", fontFamily: "monospace", fontWeight: 600 }}>{storyLabel}</span>
                <span style={{ fontSize: 11, color: "#444", fontFamily: "sans-serif" }}>Storytelling</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={storySlider} onChange={(e) => setStorySlider(Number(e.target.value))} style={{ background: "linear-gradient(to right, #C9A84C " + storySlider + "%, #252525 " + storySlider + "%)" }} />
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#3A3A3A", fontFamily: "sans-serif", lineHeight: 1.5 }}>
                {storySlider <= 30 ? "Logic-first. Evidence and structure lead every paragraph." : storySlider <= 70 ? "Mix of data and narrative. Grounded but human." : "Story-first. Scene, tension, and resolution drive the post."}
              </p>
            </div>
            <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, padding: "14px 18px" }}>
              <p style={sectionLabel}>Emoji</p>
              {EMOJI_OPTS.map((e) => <RadioRow key={e.id} active={emoji === e.id} onClick={() => setEmoji(e.id)} label={e.label} />)}
            </div>
            <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, padding: "14px 18px" }}>
              <p style={sectionLabel}>Headers</p>
              <RadioRow active={!titles} onClick={() => setTitles(false)} label="No titles" />
              <RadioRow active={titles} onClick={() => setTitles(true)} label="Add titles" />
            </div>
          </div>
          <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, padding: "14px 22px" }}>
            <p style={sectionLabel}>Word Limit per Platform</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 20 }}>
              {PLATFORMS.map((p) => {
                const cfg = WORD_LIMITS[p.id];
                const val = wordLimits[p.id];
                const pct = Math.round(((val - cfg.min) / (cfg.max - cfg.min)) * 100);
                return (
                  <div key={p.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 3, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 700, color: "#fff", fontFamily: "sans-serif" }}>{p.icon}</span>
                      <span style={{ fontSize: 11, fontFamily: "sans-serif", color: "#666" }}>{p.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#C9A84C" }}>{val}<span style={{ fontSize: 10, color: "#444", fontWeight: 400 }}> {cfg.label || "w"}</span></span>
                    <input type="range" min={cfg.min} max={cfg.max} step={10} value={val} onChange={(e) => setWordLimits(prev => ({ ...prev, [p.id]: Number(e.target.value) }))} style={{ background: "linear-gradient(to right, #C9A84C " + pct + "%, #252525 " + pct + "%)", marginTop: 6 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: "#2E2E2E", fontFamily: "monospace" }}>{cfg.min}</span>
                      <span style={{ fontSize: 9, color: "#2E2E2E", fontFamily: "monospace" }}>{cfg.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
          <button onClick={repurpose} disabled={!input.trim() || anyLoading} style={{ background: input.trim() && !anyLoading ? "#C9A84C" : "#161616", color: input.trim() && !anyLoading ? "#0D0D0D" : "#333", border: "none", borderRadius: 6, padding: "12px 36px", fontSize: 14, fontWeight: 700, fontFamily: "sans-serif", cursor: input.trim() && !anyLoading ? "pointer" : "not-allowed", letterSpacing: "0.04em" }}>
            {anyLoading ? "Generating..." : "Generate Content"}
          </button>
        </div>

        {(hasResults || anyLoading) && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <SectionHeader num="04" title="Generated Content" />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {PLATFORMS.map((p) => (
                <OutputCard key={p.id} platform={p} result={results[p.id]} isLoading={loading[p.id]} isCopied={copiedPlatform === p.id} onCopy={() => copyPlatform(p.id, results[p.id]?.post || "")} />
              ))}
            </div>
          </div>
        )}

        {!hasResults && !anyLoading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 26, marginBottom: 10, color: "#1A1A1A" }}>*</div>
            <p style={{ fontSize: 12, fontFamily: "sans-serif", color: "#2E2E2E", maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>Analyze your content, configure your strategy, and generate.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const sectionLabel = { fontSize: 11, color: "#555", fontFamily: "sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" };

function SectionHeader({ num, title, accent = "#C9A84C" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 11, color: accent, fontFamily: "monospace", opacity: 0.5 }}>{num}</span>
      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "sans-serif", letterSpacing: "-0.2px" }}>{title}</span>
      <div style={{ flex: 1, height: "1px", background: "#181818" }} />
    </div>
  );
}

function PillSelector({ label, options, value, onChange }) {
  return (
    <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, padding: "14px 16px" }}>
      <p style={sectionLabel}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => (
          <button key={o.id} className="pill-btn" onClick={() => onChange(o.id)} style={{ padding: "5px 13px", borderRadius: 20, fontFamily: "sans-serif", fontSize: 12, cursor: "pointer", border: value === o.id ? "1px solid #C9A84C" : "1px solid #252525", background: value === o.id ? "rgba(201,168,76,0.1)" : "transparent", color: value === o.id ? "#C9A84C" : "#555" }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioRow({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "5px 0" }}>
      <span style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, border: active ? "none" : "1px solid #2A2A2A", background: active ? "#C9A84C" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0D0D0D", display: "block" }} />}
      </span>
      <span style={{ fontSize: 13, fontFamily: "sans-serif", color: active ? "#F0EDE6" : "#4A4A4A" }}>{label}</span>
    </button>
  );
}

function Dot({ i, color = "#C9A84C" }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", animation: "pulse 1.2s ease-in-out infinite", animationDelay: (i * 0.2) + "s" }} />;
}

function OutputCard({ platform, result, isLoading, isCopied, onCopy }) {
  const wordCount = result?.post ? result.post.trim().split(/\s+/).filter(Boolean).length : 0;
  return (
    <div style={{ background: "#141414", border: "1px solid #1E1E1E", borderRadius: 10, overflow: "hidden", animation: result ? "fadeUp 0.3s ease" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 18px", borderBottom: "1px solid #191919", background: "#0F0F0F" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 22, height: 22, borderRadius: 4, background: platform.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff", fontFamily: "sans-serif", flexShrink: 0 }}>{platform.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "sans-serif" }}>{platform.label}</span>
          {result?.post && !isLoading && <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>{wordCount} words</span>}
        </div>
        {result?.post && !isLoading && (
          <button onClick={onCopy} style={{ fontSize: 11, color: isCopied ? "#6ECC8E" : "#444", background: "none", border: "1px solid #1E1E1E", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "sans-serif" }}>
            {isCopied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
      <div style={{ padding: "16px 20px" }}>
        {isLoading ? (
          <div style={{ display: "flex", gap: 6 }}>{[0,1,2].map(i => <Dot key={i} i={i} />)}</div>
        ) : result?.post ? (
          <>
            <pre style={{ margin: "0 0 14px", whiteSpace: "pre-wrap", fontFamily: "'Georgia', serif", fontSize: 14, lineHeight: 1.8, color: "#B0ACA4" }}>{result.post}</pre>
            {result.why && (
              <div style={{ borderTop: "1px solid #191919", paddingTop: 11, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 9, color: "#C9A84C", background: "rgba(201,168,76,0.08)", padding: "2px 7px", borderRadius: 3, flexShrink: 0, marginTop: 1, fontFamily: "sans-serif", letterSpacing: "0.06em" }}>WHY IT WORKS</span>
                <span style={{ fontSize: 12, color: "#484440", fontFamily: "sans-serif", lineHeight: 1.5, fontStyle: "italic" }}>{result.why}</span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
