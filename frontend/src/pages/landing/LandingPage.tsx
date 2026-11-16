import React from "react";
import { AuthFlow } from "./AuthFlow";
import { LandingSections } from "./LandingSections";
import { useLandingAuth } from "./useLandingAuth";

export const LandingPage: React.FC = () => {
  const auth = useLandingAuth();

  if (auth.authModal) {
    return <AuthFlow auth={auth} />;
  }

  return <LandingSections auth={auth} />;
};

export const LoginScreen = LandingPage;
