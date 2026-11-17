import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultRevealForm } from "./vault-reveal-form";

describe("VaultRevealForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the decrypted payload after a successful reveal", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ payload: "identifiant: foo / mot de passe: bar" }),
    });

    render(<VaultRevealForm groupId="grp_1" />);
    fireEvent.change(screen.getByLabelText("PIN Pitzaa"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));

    await waitFor(() => {
      expect(screen.getByText("identifiant: foo / mot de passe: bar")).toBeDefined();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/groups/grp_1/vault/reveal",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error message and keeps the form when the PIN is wrong", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "PIN incorrect." }),
    });

    render(<VaultRevealForm groupId="grp_1" />);
    fireEvent.change(screen.getByLabelText("PIN Pitzaa"), { target: { value: "0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));

    await waitFor(() => {
      expect(screen.getByText("PIN incorrect.")).toBeDefined();
    });
    expect(screen.getByLabelText("PIN Pitzaa")).toBeDefined();
  });
});
