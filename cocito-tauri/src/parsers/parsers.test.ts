/**
 * Purgatorio · testes dos parser packs per-service.
 */

import { describe, it, expect } from "vitest";
import { parseTitle } from "./index";

describe("parseTitle", () => {
  describe("slack", () => {
    it("extrai sender e channel do formato 'Sender · #channel'", () => {
      const r = parseTitle("slack", "Sample User · #general");
      expect(r.sender).toBe("Sample User");
      expect(r.channel).toBe("#general");
    });

    it("ignora a contagem (3) no início", () => {
      const r = parseTitle("slack", "(3) Sample User · #general");
      expect(r.sender).toBe("Sample User");
      expect(r.channel).toBe("#general");
    });

    it("apanha só channel quando não há sender", () => {
      const r = parseTitle("slack", "#prod-alerts · 5 new messages");
      expect(r.channel).toBe("#prod-alerts");
      expect(r.sender).toBeUndefined();
    });
  });

  describe("gmail", () => {
    it("separa sender de subject", () => {
      const r = parseTitle("gmail", "Newsletter - Weekly digest - Gmail");
      expect(r.sender).toBe("Newsletter");
      expect(r.subject).toBe("Weekly digest");
    });

    it("ignora a contagem", () => {
      const r = parseTitle("gmail", "(12) John Doe - Re: meeting - Gmail");
      expect(r.sender).toBe("John Doe");
      expect(r.subject).toBe("Re: meeting");
    });
  });

  describe("whatsapp", () => {
    it("apanha sender", () => {
      const r = parseTitle("whatsapp", "(3) Mãe");
      expect(r.sender).toBe("Mãe");
    });
  });

  describe("google-chat", () => {
    it("extrai sender e channel da DM", () => {
      const r = parseTitle("google-chat", "(2) Sample User - Direct message - Google Chat");
      expect(r.sender).toBe("Sample User");
      expect(r.channel).toBe("Direct message");
    });

    it("apanha sala quando começa com #", () => {
      const r = parseTitle("google-chat", "(5) #engineering - Google Chat");
      expect(r.channel).toBe("#engineering");
    });

    it("devolve objeto vazio quando o título é só 'Google Chat'", () => {
      const r = parseTitle("google-chat", "Google Chat");
      expect(r).toEqual({});
    });
  });

  describe("linkedin", () => {
    it("apanha messaging com remetente em EN", () => {
      const r = parseTitle("linkedin", "(1) New message from John Doe | LinkedIn");
      expect(r.sender).toBe("John Doe");
      expect(r.channel).toBe("Messaging");
    });

    it("apanha messaging com remetente em PT", () => {
      const r = parseTitle("linkedin", "(3) Maria Silva enviou-te uma mensagem | LinkedIn");
      expect(r.sender).toBe("Maria Silva");
      expect(r.channel).toBe("Messaging");
    });

    it("ignora cap (99+)", () => {
      const r = parseTitle("linkedin", "(99+) Messaging | LinkedIn");
      expect(r.channel).toBe("Messaging");
    });

    it("identifica secção do produto", () => {
      const r = parseTitle("linkedin", "Feed | LinkedIn");
      expect(r.channel).toBe("Feed");
    });
  });

  describe("desconhecido", () => {
    it("devolve objeto vazio para serviço sem parser", () => {
      const r = parseTitle("inexistente", "Qualquer coisa");
      expect(r).toEqual({});
    });
  });
});
