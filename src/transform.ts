import * as template from "./template/test";
import * as babylon from "babylon";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

export function transform(content, fileName) {
    const ast = babylon.parse(content);
    traverse(ast, {
        enter(path) {
            const node = path.node;
            /*
             rewrite function
                 function foo(){ body } -> function() { start('foo'); body; end; }
                 function(){ body } -> function() { start('anonymous'); body; end; }
            */
            if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
                const funcName = node.id === null ? "anonymous" : node.id.name;
                const funcPos = node.body.loc.start;
                const funcBody = node.body.body;

                // prepend
                funcBody.unshift(
                    start(
                        fileName,
                        funcPos.line,
                        funcPos.column + 1,
                        funcName,
                        srcLines[funcPos.line - 1].substr(0, lineLimit)
                    )
                );

                // append
                funcBody.push(end());
            }
        },
        leave(path) {
            const node = path.node;
            /*
             rewrite return
                 return expr; -> return (function(arguments) { start(); var value = expr; end(); return value; }).call(this, arguments);
            */
            if (node.type === "ReturnStatement") {
                wrapReturn(node);
            }

            /*
             rewrite var func
                var test = function() { body; }; -> function() { start("test"); body; end(); };
            */
            if (node.type === "VariableDeclarator") {
                if (node.init && node.init.type === "FunctionExpression") {
                    rewriteFuncName(node.init, node.id.name);
                }
            }

            /*
             rewrite assign func
                a.test = function() { body; }; -> function() { start("a.test"); body; end(); };
            */
            if (node.type === "AssignmentExpression") {
                if (node.right.type === "FunctionExpression") {
                    rewriteFuncName(node.right, getStaticName(node.left));
                }
            }
        }
    });
    return generate(ast, {}, content);
}

function start(fname, line, col, name, linestr) {
    var template = parseStatement("var sjsp__state = typeof sjsp__start === 'function' && sjsp__start()");
    template.declarations[0].init.right.arguments = Array.prototype.map.call(arguments, function(arg) {
        return makeLiteral(arg);
    });
    return template;
}

function end() {
    return parseStatement('typeof sjsp__end === "function" && sjsp__end(sjsp__state)');
}

function wrapReturn(returnStmt) {
    var wrapperFunc = parseStatement(
        "(function(arguments){" +
            "   var sjsp__return = __here__;" +
            "   typeof sjsp__end === 'function' && sjsp__end(sjsp__state);" +
            "   return sjsp__return;" +
            "}).call(this, arguments);"
    );

    // rewrite __here__
    wrapperFunc.expression.callee.object.body.body[0].declarations[0].init = returnStmt.argument;

    // assign express to argument.
    returnStmt.argument = wrapperFunc.expression;
}

function rewriteFuncName(funcAst, funcName) {
    var startArguments = funcAst.body.body[0].declarations[0].init.right.arguments;
    // argument[3]: function's name
    startArguments[3].value = funcName;
}

function getStaticName(expr) {
    if (expr.type === "MemberExpression") {
        return getStaticName(expr.object) + "." + expr.property.name;
    } else if (expr.type === "Identifier") {
        return expr.name;
    } else if (expr.type === "ThisExpression") {
        return "this";
    } else {
        throw "Invalid member expression";
    }
}

function parseStatement(code) {
    return esprima.parse(code).body[0];
}

function makeLiteral(literal) {
    return {
        type: "Literal",
        value: literal
    };
}
