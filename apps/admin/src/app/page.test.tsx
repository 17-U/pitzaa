import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the admin back-office title", () => {
    render(<Home />);
    expect(screen.getByText("Pitzaa — Back-office")).toBeDefined();
  });
});
