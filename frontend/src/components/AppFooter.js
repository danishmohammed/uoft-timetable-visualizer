import React from "react";

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-primary text-white text-center p-4">
      <p className="text-sm md:text-base">
        Copyright © {currentYear} Danish Mohammed. All Rights Reserved.
      </p>
    </footer>
  );
};

export default AppFooter;
