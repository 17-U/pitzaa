import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRevealCodeButton } from "./admin-reveal-code-button";

describe("AdminRevealCodeButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the plaintext code after a successful reveal", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ code: "ABCD-EFGH-IJKL" }),
    });

    render(<AdminRevealCodeButton listingId="listing_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Voir le code" }));

    await waitFor(() => {
      expect(screen.getByText("ABCD-EFGH-IJKL")).toBeDefined();
    });
    expect(fetch).toHaveBeenCalledWith("/gift-cards/admin/listing_1/reveal-code", { method: "POST" });
  });

  it("shows an error message and keeps the button when the reveal fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cette annonce a déjà été traitée." }),
    });

    render(<AdminRevealCodeButton listingId="listing_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Voir le code" }));

    await waitFor(() => {
      expect(screen.getByText("Cette annonce a déjà été traitée.")).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "Voir le code" })).toBeDefined();
  });
});
