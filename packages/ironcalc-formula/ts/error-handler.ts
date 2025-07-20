import { IronCalcError, IronCalcErrorType } from './types.js';

export class IronCalcErrorHandler {
  static handleFormulaError(error: any, context: string, cellAddress?: string): IronCalcError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    if (errorMessage.includes('circular') || errorMessage.includes('dependency')) {
      return new IronCalcError(
        IronCalcErrorType.CIRCULAR_REFERENCE,
        `Circular reference detected: ${errorMessage}`,
        context,
        cellAddress
      );
    }
    
    if (errorMessage.includes('function') || errorMessage.includes('NAME') || errorMessage.includes('#NAME?')) {
      return new IronCalcError(
        IronCalcErrorType.FUNCTION_NOT_FOUND,
        `Unknown function: ${errorMessage}`,
        context,
        cellAddress
      );
    }
    
    if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
      return new IronCalcError(
        IronCalcErrorType.MEMORY_LIMIT,
        `Memory limit exceeded: ${errorMessage}`,
        context,
        cellAddress
      );
    }
    
    if (errorMessage.includes('DIV') || errorMessage.includes('division') || errorMessage.includes('#DIV/0!')) {
      return new IronCalcError(
        IronCalcErrorType.DIVISION_BY_ZERO,
        'Division by zero in formula',
        context,
        cellAddress
      );
    }
    
    if (errorMessage.includes('REF') || errorMessage.includes('reference') || errorMessage.includes('#REF!')) {
      return new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE,
        `Invalid cell reference: ${errorMessage}`,
        context,
        cellAddress
      );
    }

    if (errorMessage.includes('VALUE') || errorMessage.includes('#VALUE!')) {
      return new IronCalcError(
        IronCalcErrorType.TYPE_MISMATCH,
        `Type mismatch in formula: ${errorMessage}`,
        context,
        cellAddress
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return new IronCalcError(
        IronCalcErrorType.TIMEOUT,
        `Formula evaluation timeout: ${errorMessage}`,
        context,
        cellAddress
      );
    }

    if (errorMessage.includes('WASM') || errorMessage.includes('WebAssembly')) {
      return new IronCalcError(
        IronCalcErrorType.WASM_ERROR,
        `WebAssembly error: ${errorMessage}`,
        context,
        cellAddress
      );
    }
    
    return new IronCalcError(
      IronCalcErrorType.FORMULA_SYNTAX,
      `Formula syntax error: ${errorMessage}`,
      context,
      cellAddress
    );
  }

  static validateFormulaInput(formula: string): void {
    if (!formula || formula.trim().length === 0) {
      throw new IronCalcError(IronCalcErrorType.FORMULA_SYNTAX, 'Formula cannot be empty');
    }
    
    if (formula.length > 8192) {
      throw new IronCalcError(
        IronCalcErrorType.FORMULA_SYNTAX, 
        'Formula too long (max 8192 characters)'
      );
    }
    
    // Check for potentially malicious patterns
    const dangerousPatterns = [
      /\beval\b/i, 
      /\bfunction\b/i, 
      /\bscript\b/i,
      /javascript:/i,
      /data:/i,
      /<script/i,
      /onclick/i,
      /onerror/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(formula)) {
        throw new IronCalcError(
          IronCalcErrorType.FORMULA_SYNTAX, 
          'Formula contains invalid or potentially unsafe patterns'
        );
      }
    }
  }

  static validateCellReference(sheet: string, row: number, col: number): void {
    if (row < 1 || row > 1048576) { // Excel row limit
      throw new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE, 
        `Invalid row: ${row} (must be 1-1048576)`
      );
    }
    
    if (col < 1 || col > 16384) { // Excel column limit  
      throw new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE, 
        `Invalid column: ${col} (must be 1-16384)`
      );
    }
    
    if (!sheet || sheet.trim().length === 0) {
      throw new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE, 
        'Sheet name cannot be empty'
      );
    }
    
    if (sheet.length > 31) { // Excel sheet name limit
      throw new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE, 
        'Sheet name too long (max 31 characters)'
      );
    }

    // Check for invalid sheet name characters
    const invalidChars = /[\\\/\?\*\[\]:]/;
    if (invalidChars.test(sheet)) {
      throw new IronCalcError(
        IronCalcErrorType.CELL_REFERENCE,
        'Sheet name contains invalid characters'
      );
    }
  }

  static createTimeoutError(operation: string, timeout: number): IronCalcError {
    return new IronCalcError(
      IronCalcErrorType.TIMEOUT,
      `Operation '${operation}' timed out after ${timeout}ms`
    );
  }

  static createMemoryLimitError(currentUsage: number, limit: number): IronCalcError {
    return new IronCalcError(
      IronCalcErrorType.MEMORY_LIMIT,
      `Memory usage (${Math.round(currentUsage / 1024 / 1024)}MB) exceeds limit (${limit}MB)`
    );
  }

  static createNotInitializedError(pluginName: string): IronCalcError {
    return new IronCalcError(
      IronCalcErrorType.PLUGIN_NOT_INITIALIZED,
      `Plugin '${pluginName}' is not initialized. Call initialize() first.`
    );
  }
}