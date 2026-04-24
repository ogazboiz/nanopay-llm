#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("nanopay")
  .description("NanoPay LLM CLI — register and manage LLM endpoints on Arc")
  .version("0.0.1");

program
  .command("register")
  .description("Register a new LLM endpoint in the on-chain ServiceRegistry")
  .requiredOption("--id <id>", "Unique provider id")
  .requiredOption("--model <model>", "Model identifier")
  .requiredOption("--price <usd>", "Price per token in USD")
  .requiredOption("--endpoint <url>", "HTTP endpoint URL")
  .requiredOption("--wallet <address>", "Service wallet address")
  .action((opts) => {
    console.log("TODO: submit registerProvider() tx to ServiceRegistry on Arc", opts);
  });

program
  .command("list")
  .description("List registered providers from the on-chain ServiceRegistry")
  .action(() => {
    console.log("TODO: read providers from ServiceRegistry");
  });

program.parseAsync(process.argv);
