const fs = require('fs');
// 解析js,将js代码转换为AST
// parser的parse方法有第二个参数sourceType, 当js代码中含有import、export (es6的代码)等关键字时
// 需要指定sourceType为module
const parser = require("@babel/parser");
// 用来遍历AST中的节点
const traverse = require("@babel/traverse").default;
// 用来判断节点类型和生成新的节点等
const type = require("@babel/types");
// 用来把AST代码转换成JS代码
// generator 也有其他参数，具体参考文档: https://babeljs.io/docs/en/@babel-generator
const generator = require("@babel/generator").default;

const js_code = fs.readFileSync("F:\\code\\SpiderCollection\\易盾\\static\\watchMan.js", {
    encoding: "utf-8"
});

let ast = parser.parse(js_code);

function generate_js(astObjList){
    // 初始话一个空的AST对象
    let newAst = parser.parse("");
    // 放入到空的AST对象中 再转为js eval加载到内存中
    astObjList.map(function(p){newAst.program.body.push(p);})
    let code = generator(newAst, {compact: true}).code;
    return code;
}

// 把多个自执行函数嵌套摊平

traverse(ast, {
    ExpressionStatement(path){
        let expression = path.node.expression;
        if (!expression) return;
        if (type.isCallExpression(expression)){
            let callEe = expression.callee;
            let callEeArguments = expression.arguments;
            // callEe为函数并且调用的时候参数为空 这里手动指定了替换的次数(需要自行判断，如果不这么做 碰见同名的变量或函数会出问题)
            if (type.isFunctionExpression(callEe) && Array.isArray(callEeArguments) && this.opt.index <=2){
                console.log("[1]提取自执行函数body")
                path.replaceWithMultiple(callEe.body.body);
                this.opt.index++;
            }
        }
    }
}, opt={"index":0})

code = generator(ast).code;
let new_ast = parser.parse(js_code);
let decrypt_body = ast.program.body.slice(0, 2);
let decrypt_code = generate_js(decrypt_body);
eval(decrypt_code)
new_ast = parser.parse(generate_js(ast.program.body.slice(2, ast.program.body.length)))

traverse(new_ast, {
    VariableDeclaration(path){
        if (path.parent.type !== "Program") return;
        path.node.declarations.map(function (node){
            let identifierName = node.id.name;
            let init = node.init;
            if (!init) return;
            let elementsValue = node.init.elements;
            if (!elementsValue) return;
            let elementsRealValue = [];
            elementsValue.map(function (ele){
                let ele_js_code = generate_js([ele])
                let realValue = eval(ele_js_code);
                elementsRealValue.push(realValue);
            })
            let Bindings = path.scope.getBinding(identifierName);
            if (Bindings && Bindings.referenced){
                Bindings.referencePaths.map(function(nodePath){
                    let parenPath = nodePath.parentPath;
                    let propertyValue = parenPath.node.property.value;
                    parenPath.replaceWith(type.valueToNode(elementsRealValue[propertyValue]))
                    console.log("[2]字符串解密")
                })
            }
        })
    }
})

new_ast = parser.parse(generate_js(new_ast.program.body.slice(2, new_ast.program.body.length)))
code = generator(new_ast).code
fs.writeFileSync("F:\\code\\SpiderCollection\\易盾\\ast_watchman_result_v2.js", code);