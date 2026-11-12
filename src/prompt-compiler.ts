interface Message {
  role: string;
  content: string | Array<any>;
}

interface ToolDefinition {
  name: string;
  description?: string;
  input_schema?: any;
}

export function compilePrompt(
  systemPrompt: string | undefined,
  messages: Message[],
  tools: ToolDefinition[]
): string {
  let prompt = `[ROLE]\nYou are Claude, an AI assistant built by Anthropic, acting as the reasoning backend for the Claude Code coding-agent runtime.\n\n`;

  if (systemPrompt) {
    prompt += `[SYSTEM INSTRUCTIONS]\n${systemPrompt}\n\n`;
  }

  prompt += `[OPERATING RULES]\n` +
    `1. You act as the reasoning engine for Claude Code. You have full access to execute tools and run shell commands.\n` +
    `2. When you need to run shell commands, inspect files, or perform tasks, output a Bash tool call or a bash code block:\n` +
    '```bash\n<command here>\n```\n' +
    `OR format as:\n` +
    `<DS_TOOL_CALL>\n{"name": "Bash", "input": {"command": "..."}}\n</DS_TOOL_CALL>\n\n` +
    `3. For other tools (Read, Write, Edit, Glob, Grep), format as:\n` +
    `<DS_TOOL_CALL>\n{"name": "Read", "input": {"file_path": "..."}}\n</DS_TOOL_CALL>\n\n` +
    `4. When providing final answers or explanations to the user, format as:\n` +
    `<DS_FINAL>\nYour final response here.\n</DS_FINAL>\n\n`;

  if (tools && tools.length > 0) {
    prompt += `[AVAILABLE TOOLS]\n`;
    for (const tool of tools) {
      prompt += `- ${tool.name}: ${tool.description || ''}\n`;
      if (tool.input_schema && tool.input_schema.properties) {
        const props = Object.keys(tool.input_schema.properties).join(', ');
        prompt += `  Inputs: (${props})\n`;
      }
    }
    prompt += `\n`;
  }

  prompt += `[CONVERSATION HISTORY]\n`;
  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
    let contentStr = '';
    if (typeof msg.content === 'string') {
      contentStr = msg.content;
    } else if (Array.isArray(msg.content)) {
      contentStr = msg.content.map(c => {
        if (c.type === 'text') return c.text;
        if (c.type === 'tool_result') return `[Tool Result for ${c.tool_use_id}]: ${c.content}`;
        if (c.type === 'tool_use') return `<DS_TOOL_CALL>\n${JSON.stringify(c)}\n</DS_TOOL_CALL>`;
        return JSON.stringify(c);
      }).join('\n');
    }
    prompt += `${roleLabel}: ${contentStr}\n\n`;
  }

  prompt += `Assistant: Provide your next thought, tool call, or final answer using the exact sentinel framing.`;
  return prompt;
}
