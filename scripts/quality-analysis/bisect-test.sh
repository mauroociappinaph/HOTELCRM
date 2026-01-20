#!/bin/bash
# Script de prueba para git bisect - verifica errores TypeScript
cd apps/auth-service
if npm run build 2>&1 | grep -q "error TS"; then
  echo "Found TypeScript errors"
  exit 1  # Bad commit
else
  echo "No TypeScript errors found"
  exit 0  # Good commit
fi
