import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the phone form", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({}) });
    render(element);
    expect(screen.getByLabelText("Numéro de téléphone")).toBeDefined();
    expect(screen.getByRole("button", { name: "Recevoir mon code" })).toBeDefined();
  });

  it("shows the mapped error message for a known error code", async () => {
    const element = await LoginPage({ searchParams: Promise.resolve({ error: "invalid_phone" }) });
    render(element);
    expect(screen.getByText(/Numéro invalide/)).toBeDefined();
  });
});
