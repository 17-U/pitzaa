import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevealCodeButton } from "./reveal-code-button";

describe("RevealCodeButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the revealed code after a successful reveal", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ code: "ABCD-EFGH-IJKL" }),
    });

    render(<RevealCodeButton orderId="order_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Révéler le code" }));

    await waitFor(() => {
      expect(screen.getByText("ABCD-EFGH-IJKL")).toBeDefined();
    });
    expect(fetch).toHaveBeenCalledWith("/gift-cards/orders/order_1/reveal", { method: "POST" });
  });

  it("shows an error message and keeps the button when the reveal fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Le code a déjà été révélé." }),
    });

    render(<RevealCodeButton orderId="order_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Révéler le code" }));

    await waitFor(() => {
      expect(screen.getByText("Le code a déjà été révélé.")).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "Révéler le code" })).toBeDefined();
  });
});
