'use strict';

const MAX_EXPRESSION_LENGTH = 120;

function tokenize(expression) {
  const tokens = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (/[0-9.]/.test(char)) {
      const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) throw new Error('Invalid number');
      tokens.push({ type: 'number', value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if ('+-*/%^()'.includes(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported character: ${char}`);
  }
  return tokens;
}

function toRpn(tokens) {
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
  const rightAssociative = new Set(['^', 'u-']);
  let expectingValue = true;

  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token);
      expectingValue = false;
      continue;
    }
    if (token.type === '(') {
      operators.push(token.type);
      expectingValue = true;
      continue;
    }
    if (token.type === ')') {
      while (operators.length && operators.at(-1) !== '(') output.push({ type: operators.pop() });
      if (operators.pop() !== '(') throw new Error('Unbalanced parentheses');
      expectingValue = false;
      continue;
    }
    let operator = token.type;
    if (operator === '-' && expectingValue) operator = 'u-';
    if (expectingValue && operator !== 'u-') throw new Error('Expected a number');
    while (operators.length && operators.at(-1) !== '(') {
      const top = operators.at(-1);
      const shouldPop = rightAssociative.has(operator)
        ? precedence[operator] < precedence[top]
        : precedence[operator] <= precedence[top];
      if (!shouldPop) break;
      output.push({ type: operators.pop() });
    }
    operators.push(operator);
    expectingValue = true;
  }
  if (expectingValue && tokens.length) throw new Error('Expression cannot end with an operator');
  while (operators.length) {
    const operator = operators.pop();
    if (operator === '(') throw new Error('Unbalanced parentheses');
    output.push({ type: operator });
  }
  return output;
}

function evaluateRpn(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (token.type === 'number') { stack.push(token.value); continue; }
    if (token.type === 'u-') {
      if (stack.length < 1) throw new Error('Invalid unary operator');
      stack.push(-stack.pop());
      continue;
    }
    if (stack.length < 2) throw new Error('Invalid expression');
    const right = stack.pop();
    const left = stack.pop();
    const value = { '+': left + right, '-': left - right, '*': left * right, '/': left / right, '%': left % right, '^': left ** right }[token.type];
    if (!Number.isFinite(value)) throw new Error('Result is not finite');
    stack.push(value);
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Invalid expression');
  return stack[0];
}

function evaluateExpression(expression) {
  const input = String(expression || '').trim();
  if (!input) throw new Error('Expression is required');
  if (input.length > MAX_EXPRESSION_LENGTH) throw new Error(`Expression is limited to ${MAX_EXPRESSION_LENGTH} characters`);
  return evaluateRpn(toRpn(tokenize(input)));
}

function formatResult(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}

module.exports = { tokenize, toRpn, evaluateRpn, evaluateExpression, formatResult };
