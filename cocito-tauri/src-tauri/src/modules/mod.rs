//! Os 10 módulos do Cocito — nomenclatura dantesca (ver §4 do plano).
//!
//! Cada um é um ficheiro. Na Semana 1 só arrancam os três primeiros; os
//! restantes são stubs para dar visibilidade da arquitetura.

pub mod caronte;       // Lifecycle de WebViews
pub mod malebolge;     // Isolamento de sessions via partitions
pub mod cerbero;       // Backbone event-driven
pub mod minos;         // Rule engine
pub mod scriptorium;   // Captura para Obsidian
pub mod virgilio;      // Indexador SQLite
pub mod beatriz;       // AI via Ollama
pub mod messo;         // Discovery Ollama
pub mod sync;          // Sync skeleton (v1.2)
pub mod audit;         // Append-only log de ações sensíveis
