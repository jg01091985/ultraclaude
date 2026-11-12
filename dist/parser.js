export function parseBrowserOutput(output) {
    // 1. Check for explicit <DS_TOOL_CALL>...</DS_TOOL_CALL>
    const toolCallMatch = output.match(/<DS_TOOL_CALL>\s*([\s\S]*?)\s*<\/DS_TOOL_CALL>/);
    if (toolCallMatch) {
        try {
            const parsed = JSON.parse(toolCallMatch[1]);
            return {
                type: 'tool_call',
                toolCall: {
                    id: parsed.id || `call_${Date.now()}`,
                    name: normalizeToolName(parsed.name || parsed.tool || "Bash"),
                    input: parsed.input || parsed.arguments || {}
                }
            };
        }
        catch (e) {
            // Fallback if JSON parse fails
        }
    }
    // 2. Check for code blocks annotated with file paths (e.g., ```html file="index.html" or ```js // file: src/app.js)
    const fileCodeMatch = output.match(/```[a-zA-Z-]*\s+(?:filename=["']([^"']+)["']|file=["']([^"']+)["']|\/\/\s*file:\s*([^\n]+)|#\s*file:\s*([^\n]+))\s*\n([\s\S]*?)\s*```/);
    if (fileCodeMatch) {
        const filePath = (fileCodeMatch[1] || fileCodeMatch[2] || fileCodeMatch[3] || fileCodeMatch[4] || "").trim();
        const fileContent = fileCodeMatch[5];
        if (filePath) {
            return {
                type: 'tool_call',
                toolCall: {
                    id: `call_${Date.now()}`,
                    name: "Write",
                    input: {
                        file_path: filePath,
                        content: fileContent.trim()
                    }
                }
            };
        }
    }
    // 3. Check for JSON code blocks containing tool call structure
    const jsonCodeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonCodeBlockMatch) {
        try {
            const parsed = JSON.parse(jsonCodeBlockMatch[1]);
            if (parsed.name || parsed.tool || parsed.command) {
                return {
                    type: 'tool_call',
                    toolCall: {
                        id: parsed.id || `call_${Date.now()}`,
                        name: normalizeToolName(parsed.name || parsed.tool || "Bash"),
                        input: parsed.input || parsed.arguments || (parsed.command ? { command: parsed.command } : {})
                    }
                };
            }
        }
        catch (e) {
            // Not valid JSON in code block
        }
    }
    // 4. Check for bash/sh code blocks and auto-wrap as Bash tool call
    const bashCodeBlockMatch = output.match(/```(?:bash|sh|shell)\s*([\s\S]*?)\s*```/);
    if (bashCodeBlockMatch) {
        const cmd = bashCodeBlockMatch[1].trim();
        if (cmd && !cmd.startsWith('{')) {
            return {
                type: 'tool_call',
                toolCall: {
                    id: `call_${Date.now()}`,
                    name: "Bash",
                    input: { command: cmd }
                }
            };
        }
    }
    // 5. Check for <DS_FINAL>...</DS_FINAL>
    const finalMatch = output.match(/<DS_FINAL>\s*([\s\S]*?)\s*<\/DS_FINAL>/);
    if (finalMatch) {
        return {
            type: 'final',
            text: finalMatch[1].trim()
        };
    }
    // 6. General text or fallback
    return {
        type: 'text',
        text: output
    };
}
const toolAliases = {
    read_file: "Read",
    read: "Read",
    filesystem_read: "Read",
    write_file: "Write",
    write: "Write",
    edit_file: "Edit",
    patch: "Edit",
    shell: "Bash",
    terminal: "Bash",
    execute: "Bash",
    search_files: "Glob",
    find_files: "Glob",
    search_text: "Grep"
};
export function normalizeToolName(name) {
    const lower = name.toLowerCase();
    return toolAliases[lower] || name;
}
