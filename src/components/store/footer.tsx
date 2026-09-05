"use client";

import { Leaf, Github, Twitter, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto bg-brand-dark text-[#faf8f1]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f28c28] text-white">
                <Leaf className="h-4 w-4" />
              </span>
              <span className="text-base font-semibold">
                Hayaan <span className="font-normal opacity-70">Market</span>
              </span>
            </div>
            <p className="mt-3 text-sm opacity-70">
              Everything you need, all in one market. Built on Next.js, Supabase,
              and Cloudflare Pages.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Shop</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm opacity-70">
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">All products</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Featured</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">New arrivals</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Gift cards</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Support</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm opacity-70">
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Help center</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Shipping &amp; returns</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Track your order</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Contact us</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Stay in touch</h3>
            <p className="mt-3 text-sm opacity-70">
              Get product drops and seasonal sales in your inbox.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs opacity-60 sm:flex-row">
          <p>© {new Date().getFullYear()} Hayaan Market. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Privacy</span>
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Terms</span>
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
