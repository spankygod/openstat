export function normalizeOpenApiDocumentForGitBook<T>(document: T): T {
  normalizeOpenApiValue(document);
  return document;
}

function normalizeOpenApiValue(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      normalizeOpenApiValue(item);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  normalizeOpenApiSchemaObject(value);

  for (const child of Object.values(value)) {
    normalizeOpenApiValue(child);
  }
}

function normalizeOpenApiSchemaObject(schema: Record<string, unknown>) {
  if (Array.isArray(schema.type)) {
    const nullable = schema.type.includes("null");
    const nonNullableTypes = schema.type.filter((type) => type !== "null");

    if (nullable) {
      schema.nullable = true;
    }

    if (nonNullableTypes.length === 1) {
      schema.type = nonNullableTypes[0];
    } else if (nonNullableTypes.length > 1) {
      delete schema.type;
      schema.oneOf = nonNullableTypes.map((type) => ({ type }));
    }
  }

  if ("const" in schema) {
    if (!("enum" in schema)) {
      schema.enum = [schema.const];
    }

    delete schema.const;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
