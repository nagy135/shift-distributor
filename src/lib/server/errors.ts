import { NextResponse } from "next/server";

export class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_INPUT",
  ) {
    super(message);
  }
}

export function requireValue(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new InputError(message, status);
}

export function apiError(error: unknown) {
  if (error instanceof InputError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Ungültige Anfrage.", code: "INVALID_JSON" },
      { status: 400 },
    );
  console.error(error);
  return NextResponse.json(
    {
      error: "Die Änderung konnte nicht gespeichert werden.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}

export async function readBody(request: Request) {
  const body = await request.json();
  requireValue(
    body && typeof body === "object" && !Array.isArray(body),
    "Ungültige Anfrage.",
  );
  return body;
}
