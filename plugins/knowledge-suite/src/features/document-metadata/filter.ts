import type {
  DocumentFieldDefinition,
  DocumentFieldValue,
  DocumentFieldValues,
  DocumentFilterCondition,
  DocumentFilterDefinition,
} from "./types";

const isEmpty = (value: DocumentFieldValue | undefined): boolean =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

const normalizedStrings = (value: DocumentFieldValue | undefined): string[] => {
  if (isEmpty(value)) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => String(item).toLocaleLowerCase());
};

export const matchesDocumentFilterCondition = (
  values: DocumentFieldValues,
  fields: readonly DocumentFieldDefinition[],
  condition: DocumentFilterCondition,
): boolean => {
  const field = fields.find((candidate) => candidate.id === condition.fieldId);
  if (!field) return false;
  const actual = values[field.key];
  if (condition.operator === "is-empty") return isEmpty(actual);
  if (condition.operator === "is-not-empty") return !isEmpty(actual);
  const actualValues = normalizedStrings(actual);
  const expectedValues = normalizedStrings(condition.value);
  if (condition.operator === "equals") {
    return actualValues.length === expectedValues.length && expectedValues.every((value) => actualValues.includes(value));
  }
  if (condition.operator === "not-equals") {
    return !(actualValues.length === expectedValues.length && expectedValues.every((value) => actualValues.includes(value)));
  }
  if (condition.operator === "contains") {
    return expectedValues.some((value) => actualValues.some((actualValue) => actualValue.includes(value)));
  }
  if (condition.operator === "not-contains") {
    return !expectedValues.some((value) => actualValues.some((actualValue) => actualValue.includes(value)));
  }
  const rawActual = Array.isArray(actual) ? actual[0] : actual;
  const rawExpected = Array.isArray(condition.value) ? condition.value[0] : condition.value;
  const actualNumber = field.type === "date" ? Date.parse(String(rawActual)) : Number(rawActual);
  const expectedNumber = field.type === "date" ? Date.parse(String(rawExpected)) : Number(rawExpected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
  return condition.operator === "greater-than"
    ? actualNumber > expectedNumber
    : actualNumber < expectedNumber;
};

export const matchesDocumentFilter = (
  values: DocumentFieldValues,
  fields: readonly DocumentFieldDefinition[],
  filter: DocumentFilterDefinition,
): boolean => {
  if (filter.conditions.length === 0) return true;
  const matches = filter.conditions.map((condition) =>
    matchesDocumentFilterCondition(values, fields, condition));
  return filter.match === "all" ? matches.every(Boolean) : matches.some(Boolean);
};
