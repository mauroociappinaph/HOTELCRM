import { Injectable, Logger } from '@nestjs/common';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

@Injectable()
export class SchemaValidatorService {
  private readonly logger = new Logger(SchemaValidatorService.name);
  private schemas = new Map<string, JsonSchema>();

  /**
   * Register a schema for validation
   */
  registerSchema(schemaId: string, schema: JsonSchema): void {
    this.schemas.set(schemaId, schema);
    this.logger.log(`📋 Registered schema: ${schemaId}`);
  }

  /**
   * Validate data against a registered schema
   */
  validateData(schemaId: string, data: any): ValidationResult {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateObject(schema, data, '', errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate data against schema directly (without registration)
   */
  validateWithSchema(schema: JsonSchema, data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateObject(schema, data, '', errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Recursive object validation
   */
  private validateObject(
    schema: JsonSchema,
    data: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Type validation
    if (schema.type && typeof data !== schema.type) {
      if (schema.type === 'number' && typeof data === 'string') {
        // Try to convert string to number
        const numValue = Number(data);
        if (!isNaN(numValue)) {
          warnings.push({
            field: path,
            message: `Converted string "${data}" to number`,
            code: 'TYPE_CONVERSION',
            value: data,
          });
          data = numValue;
        } else {
          errors.push({
            field: path,
            message: `Expected type "${schema.type}", got "${typeof data}"`,
            code: 'INVALID_TYPE',
            value: data,
          });
          return;
        }
      } else {
        errors.push({
          field: path,
          message: `Expected type "${schema.type}", got "${typeof data}"`,
          code: 'INVALID_TYPE',
          value: data,
        });
        return;
      }
    }

    // Required fields validation
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in data)) {
          errors.push({
            field: path ? `${path}.${requiredField}` : requiredField,
            message: `Required field "${requiredField}" is missing`,
            code: 'MISSING_REQUIRED_FIELD',
          });
        }
      }
    }

    // Properties validation
    if (schema.properties && typeof data === 'object' && data !== null) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        const propValue = data[propName];

        if (propValue !== undefined) {
          this.validateObject(propSchema as JsonSchema, propValue, propPath, errors, warnings);
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.items) {
        data.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          this.validateObject(schema.items as JsonSchema, item, itemPath, errors, warnings);
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        field: path,
        message: `Value "${data}" not in allowed values: ${schema.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE',
        value: data,
      });
    }

    // Numeric validations
    if (schema.type === 'number' && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          field: path,
          message: `Value ${data} is less than minimum ${schema.minimum}`,
          code: 'BELOW_MINIMUM',
          value: data,
        });
      }

      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          field: path,
          message: `Value ${data} is greater than maximum ${schema.maximum}`,
          code: 'ABOVE_MAXIMUM',
          value: data,
        });
      }
    }

    // String validations
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({
          field: path,
          message: `String length ${data.length} is less than minimum ${schema.minLength}`,
          code: 'BELOW_MIN_LENGTH',
          value: data,
        });
      }

      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `String length ${data.length} is greater than maximum ${schema.maxLength}`,
          code: 'ABOVE_MAX_LENGTH',
          value: data,
        });
      }

      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          field: path,
          message: `String "${data}" does not match pattern ${schema.pattern}`,
          code: 'INVALID_PATTERN',
          value: data,
        });
      }

      if (schema.format) {
        switch (schema.format) {
          case 'uuid':
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(data)) {
              errors.push({
                field: path,
                message: `String "${data}" is not a valid UUID`,
                code: 'INVALID_UUID_FORMAT',
                value: data,
              });
            }
            break;

          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data)) {
              errors.push({
                field: path,
                message: `String "${data}" is not a valid email`,
                code: 'INVALID_EMAIL_FORMAT',
                value: data,
              });
            }
            break;

          case 'date-time':
            const date = new Date(data);
            if (isNaN(date.getTime())) {
              errors.push({
                field: path,
                message: `String "${data}" is not a valid date-time`,
                code: 'INVALID_DATE_TIME_FORMAT',
                value: data,
              });
            }
            break;
        }
      }
    }
  }

  /**
   * Get all registered schemas
   */
  getRegisteredSchemas(): Record<string, JsonSchema> {
    return Object.fromEntries(this.schemas);
  }

  /**
   * Remove a registered schema
   */
  unregisterSchema(schemaId: string): boolean {
    return this.schemas.delete(schemaId);
  }

  /**
   * Clear all registered schemas
   */
  clearSchemas(): void {
    this.schemas.clear();
    this.logger.log('🧹 Cleared all registered schemas');
  }
}
