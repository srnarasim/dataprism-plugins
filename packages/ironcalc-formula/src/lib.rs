use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64;

// Import the console.log! macro from web-sys
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Performance metrics tracking
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PerformanceMetrics {
    total_evaluations: u32,
    average_execution_time: f64,
    error_rate: f64,
    memory_usage_bytes: usize,
    cache_hit_rate: f64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            total_evaluations: 0,
            average_execution_time: 0.0,
            error_rate: 0.0,
            memory_usage_bytes: 0,
            cache_hit_rate: 0.0,
        }
    }
}

// Formula result structure
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FormulaResult {
    value: String,
    error: Option<String>,
    execution_time_ms: u32,
    cell_address: String,
    formula_type: String,
}

// Cell and sheet management
#[derive(Clone, Debug)]
struct Cell {
    value: String,
    formula: Option<String>,
    last_calculated: f64,
    dependencies: Vec<String>,
}

struct Worksheet {
    name: String,
    cells: HashMap<(i32, i32), Cell>,
    max_row: i32,
    max_col: i32,
}

impl Worksheet {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            cells: HashMap::new(),
            max_row: 0,
            max_col: 0,
        }
    }
    
    fn set_cell(&mut self, row: i32, col: i32, value: String, formula: Option<String>) {
        let cell = Cell {
            value: value.clone(),
            formula,
            last_calculated: js_sys::Date::now(),
            dependencies: Vec::new(),
        };
        
        self.cells.insert((row, col), cell);
        
        // Update bounds
        if row > self.max_row {
            self.max_row = row;
        }
        if col > self.max_col {
            self.max_col = col;
        }
    }
    
    fn get_cell(&self, row: i32, col: i32) -> Option<&Cell> {
        self.cells.get(&(row, col))
    }
}

// Main IronCalc engine implementation
#[wasm_bindgen]
pub struct IronCalcEngine {
    worksheets: HashMap<String, Worksheet>,
    active_sheet: String,
    performance_metrics: PerformanceMetrics,
    formula_cache: HashMap<String, FormulaResult>,
    max_cache_size: usize,
}

#[wasm_bindgen]
impl IronCalcEngine {
    /// Create a new IronCalc engine instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<IronCalcEngine, JsValue> {
        console_error_panic_hook::set_once();
        console_log!("Initializing IronCalc WASM engine");
        
        let mut worksheets = HashMap::new();
        let default_sheet = "Sheet1";
        worksheets.insert(default_sheet.to_string(), Worksheet::new(default_sheet));
        
        Ok(IronCalcEngine {
            worksheets,
            active_sheet: default_sheet.to_string(),
            performance_metrics: PerformanceMetrics::default(),
            formula_cache: HashMap::new(),
            max_cache_size: 10000,
        })
    }

    /// Evaluate a formula in a specific cell
    #[wasm_bindgen(js_name = evaluateFormula)]
    pub fn evaluate_formula(
        &mut self, 
        formula: &str, 
        sheet_name: &str, 
        row: u32, 
        col: u32
    ) -> Result<JsValue, JsValue> {
        let start_time = js_sys::Date::now();
        self.performance_metrics.total_evaluations += 1;
        
        // Input validation
        if formula.is_empty() {
            return Err(JsValue::from_str("Formula cannot be empty"));
        }
        
        if formula.len() > 8192 {
            return Err(JsValue::from_str("Formula too long (max 8192 characters)"));
        }

        // Validate cell reference
        if let Err(e) = self.validate_cell_reference(sheet_name, row as i32, col as i32) {
            return Err(JsValue::from_str(&e));
        }

        // Check cache first
        let cache_key = format!("{}:{}:{}:{}", sheet_name, row, col, formula);
        if let Some(cached_result) = self.formula_cache.get(&cache_key) {
            self.performance_metrics.cache_hit_rate += 1.0;
            return Ok(serde_wasm_bindgen::to_value(cached_result)?);
        }

        // Evaluate the formula
        let result = match self.evaluate_formula_internal(formula, sheet_name, row as i32, col as i32) {
            Ok(value) => {
                let execution_time = (js_sys::Date::now() - start_time) as u32;
                self.update_performance_metrics(execution_time, true);
                
                FormulaResult {
                    value,
                    error: None,
                    execution_time_ms: execution_time,
                    cell_address: self.cell_address(col as i32, row as i32),
                    formula_type: self.classify_formula(formula),
                }
            }
            Err(error) => {
                let execution_time = (js_sys::Date::now() - start_time) as u32;
                self.update_performance_metrics(execution_time, false);
                
                FormulaResult {
                    value: String::new(),
                    error: Some(error),
                    execution_time_ms: execution_time,
                    cell_address: self.cell_address(col as i32, row as i32),
                    formula_type: "error".to_string(),
                }
            }
        };

        // Cache the result (with size limit)
        if self.formula_cache.len() < self.max_cache_size {
            self.formula_cache.insert(cache_key, result.clone());
        }

        // Store the formula and result in the worksheet
        self.set_cell_value(sheet_name, row as i32, col as i32, &result.value, Some(formula.to_string()))?;

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Set a cell value directly
    #[wasm_bindgen(js_name = setCellValue)]
    pub fn set_cell_value_js(
        &mut self,
        sheet_name: &str,
        row: u32,
        col: u32,
        value: &str
    ) -> Result<(), JsValue> {
        self.set_cell_value(sheet_name, row as i32, col as i32, value, None)
    }

    /// Get a cell value
    #[wasm_bindgen(js_name = getCellValue)]
    pub fn get_cell_value(
        &self,
        sheet_name: &str,
        row: u32,
        col: u32
    ) -> Result<String, JsValue> {
        let worksheet = self.worksheets.get(sheet_name)
            .ok_or_else(|| JsValue::from_str(&format!("Sheet '{}' not found", sheet_name)))?;
        
        if let Some(cell) = worksheet.get_cell(row as i32, col as i32) {
            Ok(cell.value.clone())
        } else {
            Ok(String::new())
        }
    }

    /// Create a new worksheet
    #[wasm_bindgen(js_name = createSheet)]
    pub fn create_sheet(&mut self, name: &str) -> Result<(), JsValue> {
        if self.worksheets.contains_key(name) {
            return Err(JsValue::from_str(&format!("Sheet '{}' already exists", name)));
        }
        
        self.worksheets.insert(name.to_string(), Worksheet::new(name));
        console_log!("Created new worksheet: {}", name);
        Ok(())
    }

    /// Get performance metrics
    #[wasm_bindgen(js_name = getPerformanceMetrics)]
    pub fn get_performance_metrics(&self) -> Result<JsValue, JsValue> {
        let mut metrics = self.performance_metrics.clone();
        
        // Calculate cache hit rate as percentage
        if self.performance_metrics.total_evaluations > 0 {
            metrics.cache_hit_rate = (metrics.cache_hit_rate / self.performance_metrics.total_evaluations as f64) * 100.0;
        }
        
        serde_wasm_bindgen::to_value(&metrics)
            .map_err(|e| JsValue::from_str(&format!("Metrics serialization error: {}", e)))
    }

    /// Clear the formula cache
    #[wasm_bindgen(js_name = clearCache)]
    pub fn clear_cache(&mut self) {
        self.formula_cache.clear();
        console_log!("Formula cache cleared");
    }

    /// Get memory usage estimate
    #[wasm_bindgen(js_name = getMemoryUsage)]
    pub fn get_memory_usage(&self) -> usize {
        let mut usage = std::mem::size_of::<Self>();
        
        // Estimate worksheet memory usage
        for worksheet in self.worksheets.values() {
            usage += std::mem::size_of_val(worksheet);
            usage += worksheet.cells.len() * std::mem::size_of::<Cell>();
        }
        
        // Estimate cache memory usage
        usage += self.formula_cache.len() * (std::mem::size_of::<String>() + std::mem::size_of::<FormulaResult>());
        
        usage
    }
}

// Private implementation methods
impl IronCalcEngine {
    fn validate_cell_reference(&self, sheet: &str, row: i32, col: i32) -> Result<(), String> {
        if row < 1 || row > 1048576 {
            return Err(format!("Invalid row: {} (must be 1-1048576)", row));
        }
        
        if col < 1 || col > 16384 {
            return Err(format!("Invalid column: {} (must be 1-16384)", col));
        }
        
        if sheet.is_empty() {
            return Err("Sheet name cannot be empty".to_string());
        }
        
        if sheet.len() > 31 {
            return Err("Sheet name too long (max 31 characters)".to_string());
        }
        
        Ok(())
    }

    fn set_cell_value(&mut self, sheet_name: &str, row: i32, col: i32, value: &str, formula: Option<String>) -> Result<(), JsValue> {
        let worksheet = self.worksheets.get_mut(sheet_name)
            .ok_or_else(|| JsValue::from_str(&format!("Sheet '{}' not found", sheet_name)))?;
        
        worksheet.set_cell(row, col, value.to_string(), formula);
        Ok(())
    }

    fn evaluate_formula_internal(&self, formula: &str, _sheet: &str, _row: i32, _col: i32) -> Result<String, String> {
        // Remove the leading = if present
        let formula = if formula.starts_with('=') {
            &formula[1..]
        } else {
            formula
        };

        // Simple formula evaluation (simulating IronCalc functionality)
        // In a real implementation, this would use IronCalc's evaluation engine
        match self.parse_and_evaluate(formula) {
            Ok(result) => Ok(result),
            Err(e) => Err(e),
        }
    }

    fn parse_and_evaluate(&self, formula: &str) -> Result<String, String> {
        let formula = formula.trim();
        
        // Handle Excel functions
        if formula.starts_with("SUM(") {
            return self.evaluate_sum_function(formula);
        } else if formula.starts_with("AVERAGE(") {
            return self.evaluate_average_function(formula);
        } else if formula.starts_with("IF(") {
            return self.evaluate_if_function(formula);
        } else if formula.starts_with("MAX(") {
            return self.evaluate_max_function(formula);
        } else if formula.starts_with("MIN(") {
            return self.evaluate_min_function(formula);
        } else if formula.starts_with("COUNT(") {
            return self.evaluate_count_function(formula);
        }
        
        // Handle simple arithmetic expressions
        if let Ok(result) = self.evaluate_arithmetic(formula) {
            return Ok(result.to_string());
        }
        
        // Handle string/number literals
        if let Ok(num) = formula.parse::<f64>() {
            return Ok(num.to_string());
        }
        
        if formula.starts_with('"') && formula.ends_with('"') {
            return Ok(formula[1..formula.len()-1].to_string());
        }
        
        Err(format!("Unsupported formula: {}", formula))
    }

    fn evaluate_sum_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "SUM")?;
        let mut total = 0.0;
        
        for arg in args {
            if let Ok(num) = arg.trim().parse::<f64>() {
                total += num;
            }
        }
        
        Ok(total.to_string())
    }

    fn evaluate_average_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "AVERAGE")?;
        let mut total = 0.0;
        let mut count = 0;
        
        for arg in args {
            if let Ok(num) = arg.trim().parse::<f64>() {
                total += num;
                count += 1;
            }
        }
        
        if count == 0 {
            return Err("#DIV/0!".to_string());
        }
        
        Ok((total / count as f64).to_string())
    }

    fn evaluate_if_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "IF")?;
        
        if args.len() < 2 {
            return Err("#VALUE!".to_string());
        }
        
        let condition = args[0].trim();
        let true_value = args.get(1).map(|s| s.trim()).unwrap_or("");
        let false_value = args.get(2).map(|s| s.trim()).unwrap_or("FALSE");
        
        // Simple condition evaluation (just check if condition contains ">" and evaluate)
        let result = if condition.contains(">") {
            let parts: Vec<&str> = condition.split('>').collect();
            if parts.len() == 2 {
                if let (Ok(left), Ok(right)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                    left > right
                } else {
                    false
                }
            } else {
                false
            }
        } else if condition.contains("<") {
            let parts: Vec<&str> = condition.split('<').collect();
            if parts.len() == 2 {
                if let (Ok(left), Ok(right)) = (parts[0].trim().parse::<f64>(), parts[1].trim().parse::<f64>()) {
                    left < right
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            // Try to parse as boolean or number
            condition.parse::<f64>().map(|n| n != 0.0).unwrap_or(false)
        };
        
        Ok(if result { 
            // Remove quotes if present
            if true_value.starts_with('"') && true_value.ends_with('"') {
                true_value[1..true_value.len()-1].to_string()
            } else {
                true_value.to_string()
            }
        } else { 
            if false_value.starts_with('"') && false_value.ends_with('"') {
                false_value[1..false_value.len()-1].to_string()
            } else {
                false_value.to_string()
            }
        })
    }

    fn evaluate_max_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "MAX")?;
        let mut max_val = f64::NEG_INFINITY;
        let mut found_number = false;
        
        for arg in args {
            if let Ok(num) = arg.trim().parse::<f64>() {
                if num > max_val {
                    max_val = num;
                }
                found_number = true;
            }
        }
        
        if !found_number {
            return Err("#VALUE!".to_string());
        }
        
        Ok(max_val.to_string())
    }

    fn evaluate_min_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "MIN")?;
        let mut min_val = f64::INFINITY;
        let mut found_number = false;
        
        for arg in args {
            if let Ok(num) = arg.trim().parse::<f64>() {
                if num < min_val {
                    min_val = num;
                }
                found_number = true;
            }
        }
        
        if !found_number {
            return Err("#VALUE!".to_string());
        }
        
        Ok(min_val.to_string())
    }

    fn evaluate_count_function(&self, formula: &str) -> Result<String, String> {
        let args = self.extract_function_args(formula, "COUNT")?;
        let mut count = 0;
        
        for arg in args {
            if arg.trim().parse::<f64>().is_ok() {
                count += 1;
            }
        }
        
        Ok(count.to_string())
    }

    fn extract_function_args(&self, formula: &str, function_name: &str) -> Result<Vec<String>, String> {
        let start_pattern = format!("{}(", function_name);
        
        if !formula.starts_with(&start_pattern) {
            return Err(format!("Invalid {} function format", function_name));
        }
        
        if !formula.ends_with(')') {
            return Err("Missing closing parenthesis".to_string());
        }
        
        let args_str = &formula[start_pattern.len()..formula.len()-1];
        
        // Simple argument parsing (doesn't handle nested functions properly)
        let args: Vec<String> = args_str.split(',').map(|s| s.to_string()).collect();
        
        Ok(args)
    }

    fn evaluate_arithmetic(&self, formula: &str) -> Result<f64, String> {
        // Very simple arithmetic evaluation (addition, subtraction, multiplication, division)
        // In a real implementation, this would use a proper expression parser
        
        if formula.contains('+') {
            let parts: Vec<&str> = formula.split('+').collect();
            if parts.len() == 2 {
                let left = parts[0].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                let right = parts[1].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                return Ok(left + right);
            }
        }
        
        if formula.contains('-') && !formula.starts_with('-') {
            let parts: Vec<&str> = formula.split('-').collect();
            if parts.len() == 2 {
                let left = parts[0].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                let right = parts[1].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                return Ok(left - right);
            }
        }
        
        if formula.contains('*') {
            let parts: Vec<&str> = formula.split('*').collect();
            if parts.len() == 2 {
                let left = parts[0].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                let right = parts[1].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                return Ok(left * right);
            }
        }
        
        if formula.contains('/') {
            let parts: Vec<&str> = formula.split('/').collect();
            if parts.len() == 2 {
                let left = parts[0].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                let right = parts[1].trim().parse::<f64>().map_err(|_| "Invalid number")?;
                if right == 0.0 {
                    return Err("#DIV/0!".to_string());
                }
                return Ok(left / right);
            }
        }
        
        Err("Unsupported arithmetic expression".to_string())
    }

    fn cell_address(&self, col: i32, row: i32) -> String {
        let col_letters = self.col_to_letters(col);
        format!("{}{}", col_letters, row)
    }

    fn col_to_letters(&self, col: i32) -> String {
        let mut result = String::new();
        let mut c = col;
        
        while c > 0 {
            c -= 1;
            result = char::from(b'A' + (c % 26) as u8).to_string() + &result;
            c /= 26;
        }
        
        result
    }

    fn classify_formula(&self, formula: &str) -> String {
        let formula = formula.trim();
        
        if formula.starts_with("SUM(") {
            "aggregate".to_string()
        } else if formula.starts_with("AVERAGE(") || formula.starts_with("MAX(") || formula.starts_with("MIN(") || formula.starts_with("COUNT(") {
            "aggregate".to_string()
        } else if formula.starts_with("IF(") {
            "logical".to_string()
        } else if formula.contains('+') || formula.contains('-') || formula.contains('*') || formula.contains('/') {
            "arithmetic".to_string()
        } else {
            "literal".to_string()
        }
    }

    fn update_performance_metrics(&mut self, execution_time: u32, success: bool) {
        let total = self.performance_metrics.total_evaluations;
        
        // Update average execution time
        let new_avg = (self.performance_metrics.average_execution_time * (total - 1) as f64 + 
                      execution_time as f64) / total as f64;
        self.performance_metrics.average_execution_time = new_avg;
        
        // Update error rate
        if !success {
            let new_error_rate = (self.performance_metrics.error_rate * (total - 1) as f64 + 1.0) / 
                                total as f64;
            self.performance_metrics.error_rate = new_error_rate;
        }
        
        // Update memory usage estimate
        self.performance_metrics.memory_usage_bytes = self.get_memory_usage();
    }
}

/// Initialize the IronCalc plugin WASM module
#[wasm_bindgen]
pub fn init_ironcalc_plugin() {
    console_error_panic_hook::set_once();
    console_log!("IronCalc plugin WASM module initialized successfully");
}

// Export types for JavaScript interop
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "FormulaResult")]
    pub type FormulaResultJs;
    
    #[wasm_bindgen(typescript_type = "PerformanceMetrics")]
    pub type PerformanceMetricsJs;
}