/** Checks a string from storage, JSON or an event against a string enum before it is used as one. */
export function isEnumValue<Value extends string>(
  enumObject: Readonly<Record<string, Value>>,
  value: unknown,
): value is Value {
  return Object.values(enumObject).some((member) => member === value);
}
