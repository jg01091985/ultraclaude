# Ultraclaude Setup Prompt Template

Copy and paste this prompt into any AI agent or terminal session on a new machine to instantly set up and configure Ultraclaude.

```markdown
Please set up Ultraclaude on this machine using the following configuration:

1. Clone repository:
   git clone https://github.com/jg01091985/ultraclaude.git ultraclaude
   cd ultraclaude

2. Configure credentials in .env:
   DEEPSEEK_USERNAME={{DEEPSEEK_USERNAME}}
   DEEPSEEK_PASSWORD={{DEEPSEEK_PASSWORD}}
   BRIDGE_PORT=4142
   GATEWAY_PORT=9080

3. Run bootstrap script:
   ./bootstrap.sh

4. Complete one-time login / Cloudflare verification (if needed):
   npm run login

5. Start using with DeepSeek Always-On Deep Think:
   ultraclaude --dangerously-skip-permissions
```
