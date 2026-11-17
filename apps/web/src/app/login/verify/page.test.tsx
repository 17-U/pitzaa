import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VerifyOtpPage from "./page";

describe("VerifyOtpPage", () => {
  it("renders the code form for the given phone number", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({ phone: "+237612345678" }),
    });
    render(element);
    expect(screen.getByText(/\+237612345678/)).toBeDefined();
    expect(screen.getByLabelText("Code reçu par SMS")).toBeDefined();
  });

  it("shows the mapped error message for a known error code", async () => {
    const element = await VerifyOtpPage({
      searchParams: Promise.resolve({ phone: "+237612345678", error: "invalid_code" }),
    });
    render(element);
    expect(screen.getByText(/Code incorrect ou expiré/)).toBeDefined();
  });
});
