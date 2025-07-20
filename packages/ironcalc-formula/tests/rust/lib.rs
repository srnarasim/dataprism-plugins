//! Rust unit tests for IronCalc WASM core

use wasm_bindgen_test::*;
use dataprism_ironcalc_plugin::*;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
fn test_engine_creation() {
    let engine = IronCalcEngine::new();
    assert!(engine.is_ok(), "Engine creation should succeed");
}

#[wasm_bindgen_test]
fn test_simple_arithmetic() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    let result = engine.evaluate_formula("=1+2+3", "Sheet1", 1, 1);
    assert!(result.is_ok(), "Simple arithmetic should succeed");
    
    let result_val = result.unwrap();
    // Parse the JSON result to check the value
    // In a real test, we'd use proper JSON parsing
    assert!(js_sys::JSON::stringify(&result_val).unwrap().as_string().unwrap().contains("\"6\""));
}

#[wasm_bindgen_test]
fn test_excel_functions() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test SUM function
    let result = engine.evaluate_formula("=SUM(1,2,3,4,5)", "Sheet1", 1, 1);
    assert!(result.is_ok(), "SUM function should work");
    
    // Test AVERAGE function
    let result = engine.evaluate_formula("=AVERAGE(10,20,30)", "Sheet1", 1, 2);
    assert!(result.is_ok(), "AVERAGE function should work");
    
    // Test IF function
    let result = engine.evaluate_formula("=IF(5>3,\"YES\",\"NO\")", "Sheet1", 1, 3);
    assert!(result.is_ok(), "IF function should work");
}

#[wasm_bindgen_test]
fn test_error_handling() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test division by zero
    let result = engine.evaluate_formula("=1/0", "Sheet1", 1, 1);
    assert!(result.is_ok(), "Division by zero should be handled gracefully");
    
    // Test invalid function
    let result = engine.evaluate_formula("=UNKNOWN_FUNC()", "Sheet1", 1, 1);
    assert!(result.is_ok(), "Unknown function should return error in result");
    
    // Test empty formula
    let result = engine.evaluate_formula("", "Sheet1", 1, 1);
    assert!(result.is_err(), "Empty formula should be rejected");
}

#[wasm_bindgen_test]
fn test_cell_operations() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test setting and getting cell values
    let set_result = engine.set_cell_value_js("Sheet1", 1, 1, "42");
    assert!(set_result.is_ok(), "Setting cell value should succeed");
    
    let get_result = engine.get_cell_value("Sheet1", 1, 1);
    assert!(get_result.is_ok(), "Getting cell value should succeed");
    assert_eq!(get_result.unwrap(), "42", "Cell value should match what was set");
}

#[wasm_bindgen_test]
fn test_sheet_management() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test creating a new sheet
    let result = engine.create_sheet("TestSheet");
    assert!(result.is_ok(), "Creating sheet should succeed");
    
    // Test creating duplicate sheet
    let result = engine.create_sheet("TestSheet");
    assert!(result.is_err(), "Creating duplicate sheet should fail");
}

#[wasm_bindgen_test]
fn test_performance_metrics() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Perform some operations
    let _ = engine.evaluate_formula("=1+1", "Sheet1", 1, 1);
    let _ = engine.evaluate_formula("=SUM(1,2,3)", "Sheet1", 1, 2);
    
    // Get performance metrics
    let metrics = engine.get_performance_metrics();
    assert!(metrics.is_ok(), "Getting performance metrics should succeed");
}

#[wasm_bindgen_test]
fn test_memory_usage() {
    let engine = IronCalcEngine::new().unwrap();
    
    let memory_usage = engine.get_memory_usage();
    assert!(memory_usage > 0, "Memory usage should be positive");
    assert!(memory_usage < 100_000_000, "Memory usage should be reasonable"); // < 100MB
}

#[wasm_bindgen_test]
fn test_cache_operations() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test cache clearing
    engine.clear_cache();
    // Should not panic or error
    
    // Test formula caching by evaluating the same formula twice
    let formula = "=SUM(1,2,3,4,5)";
    let result1 = engine.evaluate_formula(formula, "Sheet1", 1, 1);
    let result2 = engine.evaluate_formula(formula, "Sheet1", 1, 1);
    
    assert!(result1.is_ok() && result2.is_ok(), "Cached formula evaluation should work");
}

#[wasm_bindgen_test]
fn test_input_validation() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test invalid row
    let result = engine.evaluate_formula("=1+1", "Sheet1", 0, 1);
    assert!(result.is_err(), "Invalid row should be rejected");
    
    // Test invalid column
    let result = engine.evaluate_formula("=1+1", "Sheet1", 1, 0);
    assert!(result.is_err(), "Invalid column should be rejected");
    
    // Test long formula
    let long_formula = "=".to_string() + &"1+".repeat(10000) + "1";
    let result = engine.evaluate_formula(&long_formula, "Sheet1", 1, 1);
    assert!(result.is_err(), "Overly long formula should be rejected");
}

#[wasm_bindgen_test]
fn test_complex_formulas() {
    let mut engine = IronCalcEngine::new().unwrap();
    
    // Test nested function
    let result = engine.evaluate_formula("=IF(SUM(1,2,3)>5,MAX(10,20,30),MIN(1,2,3))", "Sheet1", 1, 1);
    assert!(result.is_ok(), "Complex nested formula should work");
    
    // Test multiple arithmetic operations
    let result = engine.evaluate_formula("=((10+5)*2-3)/7", "Sheet1", 1, 2);
    assert!(result.is_ok(), "Complex arithmetic should work");
}