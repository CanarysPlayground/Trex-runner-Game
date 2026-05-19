---
name: trex-gameplay-agent
description: Main orchestrator agent for TRX Runner game. Delegates tasks like performance optimization and feature implementation to specialized agents.
argument-hint: Provide a task such as "optimize gameplay", "add feature", or "analyze performance".
tools: [read, agent, edit, search, com.atlassian/atlassian-mcp-server/search, com.microsoft/azure/search, azure-mcp/search, browser]
handoffs:
  - label: Delegate to Optimizer
    agent: trex-optimizer-agent
    prompt: Optimize the gameplay performance based on the user's request.
    send: true
    model: GPT-4.1 (copilot)
  - label: Delegate to Feature Agent
    agent: trex-feature-agent
    prompt: Implement the requested feature in the TRX Runner game.
    send: true
    model: GPT-4.1 (copilot)
---
