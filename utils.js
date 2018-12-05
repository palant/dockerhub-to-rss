"use strict";

function escape(text)
{
  text = String(text || "");
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

exports.escape = escape;
