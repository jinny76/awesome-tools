# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI toolkit called "awesome_tools" (强大工具集合) - a collection of awesome utility commands built with Commander.js. The project is designed as an extensible command-line interface for executing specific tasks locally.

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
- `git-stats [options]` - Git repository commit history analysis with detailed statistics
- `clean-code -d <path> [options]` - Clean dead code in Vue+Vite projects
- `debug-file -d <path> -f <file>` - Debug why a specific file is marked as dead code
- `clean-code -d <path> --runtime` - Inject runtime tracking into Vue application
- `clean-code -d <path> --analyze-runtime` - Analyze collected runtime usage data

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
- **Binary**: Configured as `awesome-tools` command in package.json
- **Node Requirements**: >=18.0.0
- **Single Dependency**: commander for CLI framework

## Project Structure

```
awesome_tools/
├── bin/cli.js          # Main CLI executable and all commands
├── package.json        # Project config with binary definition
└── package-lock.json   # Dependency lock
```

## Key Features

### Git Statistics Analysis (`git-stats`)
The main feature is comprehensive Git repository analysis with options for:
- Time range filtering (`--since`, `--until`)
- Author filtering (`--author`)  
- File exclusion patterns (`--exclude`) with wildcard support
- Multiple statistical views: author contributions, file type analysis, daily activity charts
- Visual horizontal bar charts for activity visualization
- Excludes merge commits to focus on actual development work

### File Exclusion System
Supports comma-separated patterns: `"*.lock,node_modules/*,dist/*"`
- Wildcard matching with `*`
- Exact filename matching
- Path-based exclusions

### Dead Code Cleaning (`clean-code`)
Advanced static analysis tool for Vue+Vite projects with comprehensive path resolution:

**Configuration Support:**
- **Vite Config**: Parses `vite.config.js/ts/mjs` for alias and extensions
- **Vue CLI Config**: Parses `vue.config.js` for webpack alias configuration
- **Path Aliases**: Supports `@`, custom aliases defined in build configs
- **Extensions**: Respects configured file extensions resolution

**Advanced Import/Export Analysis:**
- **Named Imports**: `import {tempMousePosition} from "@/event/pipeline3/LineNet3"`
- **Default Imports**: `import Component from './Component.vue'`
- **Namespace Imports**: `import * as utils from './utils'`
- **Mixed Imports**: `import Component, {helper} from './module'`
- **Re-exports**: `export {item} from './other'`, `export * from './all'`
- **Dynamic Imports**: `import('./component.vue')`, template literals
- **Vue Router Lazy Loading**: `component: () => import('./views/Home.vue')`
- **Webpack Code Splitting**: `require.ensure()` patterns
- **Import-Export Matching**: Tracks which specific exports are actually used

**Smart Entry Point Detection:**
- Standard entry files (main.js, App.vue, index.js)
- Configuration files (vite.config.js, vue.config.js, etc.)
- Router and store index files (router/index.js, store/index.js)
- Plugin directories and utility files
- Asset files (CSS, SCSS, images in assets/)
- Test files to prevent deletion of test utilities

**Precision Analysis:**
- **File-Level Detection**: Identifies completely unused files
- **Export-Level Detection**: Finds unused exports in used files
- **Usage Statistics**: Shows file usage rates and detailed metrics
- **Safe Mode**: Only deletes files, preserves unused exports by default

**Debugging Tools:**
- **Debug Mode**: `--debug` flag for detailed analysis information
- **File-Specific Debug**: `--debug-file <path>` to analyze why a specific file is marked as dead
- **Standalone Debug Command**: `debug-file` command for deep investigation
- **Reference Chain Tracking**: Shows complete import/export dependency chains
- **Alias Resolution Debug**: Displays how path aliases are being resolved

**Safety Features:**
- **Backup System**: Automatic backup before deletion with restore capability
- **Test Integration**: Runs `npm run dev` to verify changes don't break build  
- **Interactive Mode**: Requires user confirmation before deletion
- **Dry Run**: Preview mode to see what would be deleted
- **Recursive Analysis**: Deep dependency traversal including dynamic imports

**Runtime Scanning (`--runtime`):**
Advanced dynamic analysis that complements static analysis by tracking actual usage:

**Core Features:**
- **JavaScript Injection**: Automatically injects tracking script into HTML files
- **Vue Framework Detection**: Supports both Vue 2 and Vue 3 applications
- **Component Tracking**: Monitors component creation, mounting, and registration
- **Method Call Tracking**: Records when Vue methods are actually invoked
- **Route Usage Monitoring**: Tracks Vue Router navigation patterns
- **Real-time Data Collection**: Collects usage data during application runtime
- **Local Storage**: Stores usage data in browser localStorage for analysis
- **Non-intrusive**: Minimal performance impact on running application

**Vue 3 Specific Support:**
- **Composition API Tracking**: Monitors ref, reactive, computed, watch usage
- **createApp Detection**: Tracks Vue 3 application creation and mounting
- **Plugin Usage**: Records Vue 3 plugin installations (router, pinia, etc.)
- **Vue Router 4**: Enhanced support for Vue Router 4 navigation tracking
- **Pinia Integration**: Detects and tracks Pinia store usage
- **Element Plus**: Identifies Element Plus component usage

**Technology Stack Compatibility:**
- Vue 3.4+ with Composition API
- Vue Router 4.2+ with history mode
- Pinia 2.1+ for state management
- Element Plus 2.5+ UI components
- Axios 1.6+ for HTTP requests

**Usage:**
```bash
# Step 1: Inject runtime tracking
node bin/cli.js clean-code -d /path/to/vue-project --runtime

# Step 2: Run your Vue application and use it normally
# The tracking script will collect usage data automatically

# Step 3: Analyze collected runtime data
node bin/cli.js clean-code -d /path/to/vue-project --analyze-runtime
```

**Benefits:**
- Identifies code that appears used statically but is never executed
- Catches dynamic imports and runtime-only dependencies
- Provides real user behavior insights
- Reduces false positives in dead code detection
- Complements static analysis with runtime evidence

## Development Notes

- **No testing framework** currently configured (test script is placeholder)
- **No linting/formatting** tools setup
- **Single-file architecture** suitable for current scale but may need refactoring as commands grow
- **Chinese localization** throughout user-facing text
- Complex git analysis logic in `generateGitStats()` function (bin/cli.js:123-438)