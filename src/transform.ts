import * as babylon from "babylon";
import traverse from "@babel/traverse";
import { Node } from "@babel/types";
import generate, { GeneratorResult } from "@babel/generator";

export interface TransformTemplate {
    functionStart(): () => Node;

    functionReturn(): () => Node;

    functionEnd(): () => Node;
}

export function transform(content: string, template: TransformTemplate, _fileName?: string): GeneratorResult {
    const ast = babylon.parse(content);
    traverse(ast, {
        FunctionDeclaration(path) {
            // push start
            // push end
            if (!path.node.body) {
                return;
            }
            (path as any).unshiftContainer("body", template.functionStart()());
        },
        FunctionExpression(_path) {},
        /*
            rewrite var func
            var test = function() { body; }; -> function() { start("test"); body; end(); };
        */
        VariableDeclarator(_path) {
            // if (node.init && node.init.type === "FunctionExpression") {
            //     // nameをassignする
            //     rewriteFuncName(node.init, node.id.name);
            // }
        },
        AssignmentExpression(_path) {
            /*
             rewrite assign func
                a.test = function() { body; }; -> function() { start("a.test"); body; end(); };
            */
        },
        ReturnStatement(_path) {
            /*
             rewrite return
                 return expr; -> return (function(arguments) { start(); var value = expr; end(); return value; }).call(this, arguments);
            */
        }
    });
    return generate(ast, {}, content).code;
}

export function getStaticName(expr: any) {
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
