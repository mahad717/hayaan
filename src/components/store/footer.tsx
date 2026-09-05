"use client";

import { ShoppingBag, Github, Twitter, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="font-semibold">Mercado</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A demo storefront built on Next.js, Prisma, and Supabase-ready auth.
              Deploy to Cloudflare Pages in minutes.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium">Shop</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>All products</li>
              <li>Featured</li>
              <li>New arrivals</li>
              <li>Gift cards</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium">Support</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>Help center</li>
              <li>Shipping &amp; returns</li>
              <li>Track your order</li>
              <li>Contact us</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium">Stay in touch</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Get product drops and seasonal sales in your inbox.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Mercado. Built with Next.js · Supabase-ready · Cloudflare-deployable.</p>
          <div className="flex gap-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
