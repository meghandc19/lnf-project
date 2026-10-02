import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
    {
      status: 500,
    }
  );
}