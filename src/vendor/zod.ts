export type ZodPath = (string | number)[];

export interface ZodIssue {
  message: string;
  path: ZodPath;
}

export class ZodError extends Error {
  issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super(issues[0]?.message ?? 'Invalid input');
    this.name = 'ZodError';
    this.issues = issues;
  }
}

export type SafeParseSuccess<T> = { success: true; data: T };
export type SafeParseFailure = { success: false; error: ZodError };
export type SafeParseReturnType<T> = SafeParseSuccess<T> | SafeParseFailure;

type Parser<T> = (input: unknown, path: ZodPath) => T;

type SchemaDef = {
  type: string;
  isOptional?: boolean;
  hasDefault?: boolean;
  defaultValue?: unknown;
};

export interface BaseSchema<T> {
  _def: SchemaDef;
  _parse(input: unknown, path: ZodPath): T;
  parse(input: unknown): T;
  safeParse(input: unknown): SafeParseReturnType<T>;
  optional(): BaseSchema<T | undefined>;
  default(value: T): BaseSchema<T>;
}

function createSchema<T>(parser: Parser<T>, def: SchemaDef): BaseSchema<T> {
  const schema: BaseSchema<T> = {
    _def: def,
    _parse(value: unknown, path: ZodPath): T {
      return parser(value, path);
    },
    parse(value: unknown): T {
      return parser(value, []);
    },
    safeParse(value: unknown): SafeParseReturnType<T> {
      try {
        return { success: true, data: parser(value, []) };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error };
        }
        throw error;
      }
    },
    optional(): BaseSchema<T | undefined> {
      return createSchema<T | undefined>(
        (value, path) => {
          if (value === undefined) {
            return undefined;
          }
          return parser(value, path);
        },
        { ...def, isOptional: true }
      );
    },
    default(value: T): BaseSchema<T> {
      return createSchema<T>(
        (input, path) => {
          if (input === undefined) {
            return value;
          }
          return parser(input, path);
        },
        { ...def, hasDefault: true, defaultValue: value }
      );
    }
  };

  return schema;
}

function createIssue(message: string, path: ZodPath): ZodIssue {
  return { message, path };
}

export interface StringSchema extends BaseSchema<string> {
  min(length: number, message?: string): StringSchema;
  url(message?: string): StringSchema;
}

function string(): StringSchema {
  const checks: Array<(value: string, path: ZodPath) => void> = [];

  const schema = createSchema<string>(
    (value, path) => {
      if (typeof value !== 'string') {
        throw new ZodError([createIssue('Expected string', path)]);
      }
      for (const check of checks) {
        check(value, path);
      }
      return value;
    },
    { type: 'string' }
  ) as StringSchema;

  schema.min = (length: number, message = `Expected string length >= ${length}`) => {
    checks.push((value, path) => {
      if (value.length < length) {
        throw new ZodError([createIssue(message, path)]);
      }
    });
    return schema;
  };

  schema.url = (message = 'Expected URL') => {
    checks.push((value, path) => {
      try {
        // eslint-disable-next-line no-new
        new URL(value);
      } catch {
        throw new ZodError([createIssue(message, path)]);
      }
    });
    return schema;
  };

  return schema;
}

export interface NumberSchema extends BaseSchema<number> {
  int(message?: string): NumberSchema;
  positive(message?: string): NumberSchema;
}

function number(): NumberSchema {
  const checks: Array<(value: number, path: ZodPath) => void> = [];

  const schema = createSchema<number>(
    (value, path) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ZodError([createIssue('Expected number', path)]);
      }
      for (const check of checks) {
        check(value, path);
      }
      return value;
    },
    { type: 'number' }
  ) as NumberSchema;

  schema.int = (message = 'Expected integer') => {
    checks.push((value, path) => {
      if (!Number.isInteger(value)) {
        throw new ZodError([createIssue(message, path)]);
      }
    });
    return schema;
  };

  schema.positive = (message = 'Expected positive number') => {
    checks.push((value, path) => {
      if (value <= 0) {
        throw new ZodError([createIssue(message, path)]);
      }
    });
    return schema;
  };

  return schema;
}

export interface ArraySchema<T> extends BaseSchema<T[]> {
  min(length: number, message?: string): ArraySchema<T>;
}

function array<T>(itemSchema: BaseSchema<T>): ArraySchema<T> {
  const checks: Array<(value: T[], path: ZodPath) => void> = [];

  const schema = createSchema<T[]>(
    (value, path) => {
      if (!Array.isArray(value)) {
        throw new ZodError([createIssue('Expected array', path)]);
      }
      const result = value.map((entry, index) => itemSchema._parse(entry, [...path, index]));
      for (const check of checks) {
        check(result, path);
      }
      return result;
    },
    { type: 'array' }
  ) as ArraySchema<T>;

  schema.min = (length: number, message = `Expected array length >= ${length}`) => {
    checks.push((value, path) => {
      if (value.length < length) {
        throw new ZodError([createIssue(message, path)]);
      }
    });
    return schema;
  };

  return schema;
}

type EnumValues = [string, ...string[]];

function enumType<TValues extends EnumValues>(values: TValues): BaseSchema<TValues[number]> {
  const valueSet = new Set(values);

  return createSchema<TValues[number]>(
    (value, path) => {
      if (typeof value !== 'string') {
        throw new ZodError([createIssue('Expected string', path)]);
      }
      if (!valueSet.has(value)) {
        throw new ZodError([createIssue(`Expected one of: ${values.join(', ')}`, path)]);
      }
      return value as TValues[number];
    },
    { type: 'enum' }
  );
}

type ObjectShape = Record<string, BaseSchema<any>>;

type ObjectResult<TShape extends ObjectShape> = {
  [K in keyof TShape]: ReturnType<TShape[K]['parse']>;
};

function object<TShape extends ObjectShape>(shape: TShape): BaseSchema<ObjectResult<TShape>> {
  return createSchema<ObjectResult<TShape>>(
    (value, path) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ZodError([createIssue('Expected object', path)]);
      }

      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        const schema = shape[key];
        const raw = (value as Record<string, unknown>)[key];
        const parsed = schema._parse(raw, [...path, key]);
        if (parsed !== undefined || raw !== undefined || schema._def.hasDefault) {
          result[key] = parsed;
        }
      }

      return result as ObjectResult<TShape>;
    },
    { type: 'object' }
  );
}

const z = {
  string,
  number,
  array,
  enum: enumType,
  object
};

export type Infer<TSchema extends BaseSchema<any>> = TSchema extends BaseSchema<infer T> ? T : never;

export { z };

export namespace z {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  export type infer<TSchema extends BaseSchema<any>> = Infer<TSchema>;
}
