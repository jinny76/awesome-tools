# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI toolkit called "local_tools" (本地工具集合) - a collection of local utility commands built with Commander.js. The project is designed as an extensible command-line interface for executing specific tasks locally.

## Development Commands

```bash
# Run the CLI application
npm start -- <command> [options]

# Test commands directly
node bin/cli.js <command> [options]

# View available commands
npm start -- --help
```

**Available CLI Commands:**
- `hello --name <name>` - Greeting command
- `date` - Display current date/time in Chinese locale  
- `info` - Show system information (Node.js version, OS, architecture)

## Architecture

### CLI Structure
- **Entry Point**: `bin/cli.js` - Main executable with shebang for direct execution
- **Framework**: Commander.js v13+ for command parsing and help generation
- **Pattern**: Command-based architecture where each command has its own action handler
- **Localization**: Chinese descriptions and output formatting

### Command Pattern
New commands follow this structure in `bin/cli.js`:
```javascript
program
  .command('command-name')
  .description('命令描述')
  .option('-o, --option <value>', '选项描述', 'default')
  .action((options) => {
    // Command implementation
  });
```

### Package Configuration
- **Binary**: Configured as `local-tools` command in package.json
- **Node Requirements**: >=18.0.0
- **Single Dependency**: commander for CLI framework

## Project Structure

```
local_tools/
├── bin/cli.js          # Main CLI executable and all commands
├── package.json        # Project config with binary definition
└── package-lock.json   # Dependency lock
```

## Development Notes

- **No testing framework** currently configured (test script is placeholder)
- **No linting/formatting** tools setup
- **Single-file architecture** suitable for current scale but may need refactoring as commands grow
- **Chinese localization** throughout user-facing text
- Commands output directly to console with Chinese formatting