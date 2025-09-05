module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
    "./node_modules/react-virtual-tryon/dist/**/*.{js,jsx}", // ✅ Include lib
  ],
  safelist: [
    // Tailwind utility classes used dynamically or by Radix
    "data-[state=open]",
    "data-[state=closed]",
    "data-[disabled]",
    "data-[highlighted]",
    "data-[orientation=horizontal]",
    "data-[orientation=vertical]",

    // Example common component classes
    "bg-white",
    "bg-black",
    "text-white",
    "text-black",
    "rounded",
    "shadow",
    "p-2",
    "p-3",
    "p-4",
    "w-full",
    "h-full",
    "z-50",
    "overflow-auto",
    "fixed",
    "absolute",
    "top-0",
    "left-0",
    "right-0",
    "bottom-0",

    // Button or modal classes from your library
    "tryon-button",
    "tryon-modal",
    "tryon-overlay",
    "tryon-close",
  ], // 🚨 Temporarily allow all classes (for debugging)
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        shimmer: {
          "100%": {
            transform: "translateX(100%)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },

        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeSlideUp: {
          from: { opacity: 0, transform: "translateY(60px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeScaleUp: {
          from: { opacity: 0, transform: "scale(0.8)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        fadeSlideRight: {
          from: { opacity: 0, transform: "translateX(-20px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        fadeRotateClockwise: {
          from: { opacity: 0, transform: "rotate(-10deg)" },
          to: { opacity: 1, transform: "rotate(0)" },
        },
        fadeSlideLeft: {
          from: { opacity: 0, transform: "translateX(20px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        fadeSlideDown: {
          from: { opacity: 0, transform: "translateY(-20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeScaleDown: {
          from: { opacity: 0, transform: "scale(1.2)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        fadeRotateCounterClockwise: {
          from: { opacity: 0, transform: "rotate(10deg)" },
          to: { opacity: 1, transform: "rotate(0)" },
        },
        glow: {
          "0%, 100%": {
            filter: "drop-shadow(0 0 4px rgba(168, 85, 247, 0.8))",
          },
          "50%": { filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 1))" },
        },
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
        float: "float 2s ease-in-out infinite",
        "fade-in": "fadeIn 1s ease-in-out",
        "fade-slide-up": "fadeSlideUp 0.4s ease-in-out",
        "fade-scale-up": "fadeScaleUp 0.4s ease-in-out",
        "fade-slide-right": "fadeSlideRight 1s ease-in-out",
        "fade-rotater-clockwise": "fadeRotateClockwise 1s ease-in-out",
        "fade-slide-left": "fadeSlideLeft 1s ease-in-out",
        "fade-slide-down": "fadeSlideDown 1s ease-in-out",
        "fade-scale-down": "fadeScaleDown 1s ease-in-out",
        "fade-rotate-counter-clockwise":
          "fadeRotateCounterClockwise 1s ease-in-out",
        "glow-lock": "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
