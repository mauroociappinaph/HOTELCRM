# 🛠️ HOTELCRM Scripts Directory

## 📁 Structure

```
scripts/
├── quality-analysis/    # Code quality and analysis tools
│   ├── bisect-test.sh          # Git bisect testing script
│   └── run-code-quality-analysis.sh  # Comprehensive quality analysis
└── demos/               # Demonstration and example scripts
    └── demo-multi-agent-typescript.ts  # Multi-agent coordination demo
```

## 🚨 Security Notice

**These scripts contain executable code that runs with system privileges.**

### ⚠️ Security Considerations:
- Scripts are moved here to prevent accidental execution from root directory
- All scripts should be reviewed before execution
- Consider running in isolated environments
- Scripts may require specific permissions

### 🔒 Access Control:
- Scripts directory should be protected in production
- Consider restricting execution permissions
- Audit script usage regularly

## 🏃‍♂️ Usage

### Code Quality Analysis
```bash
cd scripts/quality-analysis
./run-code-quality-analysis.sh
```

### Git Bisect Testing
```bash
cd scripts/quality-analysis
./bisect-test.sh
```

### Demo Execution
```bash
cd scripts/demos
npx tsx demo-multi-agent-typescript.ts
```

## 📋 Script Categories

### 🔍 Quality Analysis Scripts
- Automated code quality checks
- TypeScript compilation validation
- Dependency analysis
- Security pattern detection

### 🎭 Demo Scripts
- Technology demonstrations
- Architecture showcases
- Feature previews
- Educational examples

## 🤝 Contributing

When adding new scripts:
1. Place in appropriate subdirectory
2. Add execution permissions if needed: `chmod +x script.sh`
3. Document purpose and usage in this README
4. Consider security implications
5. Test in isolated environment first

## 📞 Support

For script-related questions or issues, contact the development team.
