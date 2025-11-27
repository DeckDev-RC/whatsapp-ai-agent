/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    primary: '#0f172a', // Slate 900
                    secondary: '#1e293b', // Slate 800
                    glass: 'rgba(30, 41, 59, 0.7)', // Slate 800 with opacity
                },
                text: {
                    primary: '#f8fafc', // Slate 50
                    secondary: '#94a3b8', // Slate 400
                },
                border: {
                    glass: 'rgba(255, 255, 255, 0.1)',
                },
                accent: {
                    DEFAULT: '#3b82f6', // Blue 500
                    hover: '#2563eb', // Blue 600
                },
            },
            backdropBlur: {
                glass: '12px',
            },
        },
    },
    plugins: [],
}
