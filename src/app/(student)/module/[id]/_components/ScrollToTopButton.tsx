"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

export function ScrollToTopButton() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // O primeiro <main> do DOM é sempre o do layout (que possui overflow-y-auto)
        const scrollTarget = document.getElementsByTagName("main")[0] || window;

        const toggleVisibility = () => {
            const currentScroll = scrollTarget instanceof HTMLElement ? scrollTarget.scrollTop : window.scrollY;
            if (currentScroll > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        scrollTarget.addEventListener("scroll", toggleVisibility);
        return () => scrollTarget.removeEventListener("scroll", toggleVisibility);
    }, []);

    const scrollToTop = () => {
        const scrollTarget = document.getElementsByTagName("main")[0];
        if (scrollTarget) {
            scrollTarget.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        } else {
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    };

    if (!isVisible) return null;

    return (
        <>
            {/* Desktop: Sticky Sidebar Symmetrical to Back Button */}
            <div className="hidden lg:block sticky top-[80vh] h-fit shrink-0 -mr-16 ml-6 z-20 animate-in fade-in duration-300">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={scrollToTop}
                    className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 hover:bg-gray-50 text-gray-400 hover:text-blue-600 active:scale-95 transition-all group"
                >
                    <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
            </div>

            {/* Mobile/Tablet: Fixed FAB in bottom right corner */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={scrollToTop}
                    className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-150 hover:bg-gray-50 text-gray-400 hover:text-blue-600 active:scale-95 transition-all group"
                >
                    <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
            </div>
        </>
    );
}
