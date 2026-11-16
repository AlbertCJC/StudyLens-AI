import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingSections } from "../src/pages/landing/LandingSections";
import type { LandingAuthController } from "../src/pages/landing/useLandingAuth";

describe("LandingSections", () => {
  it("renders the hero and opens registration from the header", () => {
    const setAuthModal = vi.fn();
    const auth = {
      activeTab: "home",
      darkMode: false,
      setDarkMode: vi.fn(),
      setAuthModal,
      openRegisterModal: vi.fn(),
      scrollToSection: vi.fn(),
      handleFeatureCardClick: vi.fn(),
    } as unknown as LandingAuthController;

    render(<LandingSections auth={auth} />);

    expect(screen.getByText(/Transform Your Learning/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(setAuthModal).toHaveBeenCalledWith("login");
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });
});
