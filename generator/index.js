const fs = require('fs')
const path = require('path')
const recast = require('recast')

module.exports = (api, options, rootOptions, invoking) => {
  const routerRootDir = './src/router'
  const viewsRootDir = './src/views'
  const routerRootFile = './src/router/index.js'
  const templatesRoot = './templates'
  const moduleDir = path.join(routerRootDir, `${options.moduleName}`)
  const viewsDir = path.join(viewsRootDir, `${options.moduleName}`)

  // Verify router plugin installed
  if (!api.hasPlugin('router')) {
    api.exitLog('Vue-Router plugin has not been installed', 'warn')
    return
  }

  // Check router module directory if module already exists
  if (fs.existsSync(`src/router/${options.moduleName}`) && fs.existsSync(`src/views/${options.moduleName}`)) {
    api.exitLog(`Route module ${options.moduleName} already exists`, 'warn')
    return
  }

  // Render module template files
  api.render({
    [`${moduleDir}/index.js`]: `${templatesRoot}/module/index.js`,
    [`${viewsDir}/${options.moduleName}Home.vue`]: `${templatesRoot}/module/Home.vue`
  })

  api.exitLog('Rendered template files', 'info')

  // Verify routerRootFile exists, if not Render
  if (!fs.existsSync(`${routerRootFile}`)) {
    api.render({
      [`${routerRootFile}`]: `${templatesRoot}/index.js`
    })
    api.exitLog('Router root file rendered', 'info')
  }

  api.onCreateComplete((files) => {
    // inject new module name into the root router file
    const code = fs.readFileSync(`${routerRootFile}`, 'utf8')
    const ast = recast.parse(code)

    // New option expression to inject
    const expression = `${options.moduleName}Routes`

    recast.types.visit(ast, {
      visitCallExpression({
        node
      }) {
        if (node.callee.object.name === 'baseRoutes') {
          node.arguments.push(expression)
          /* const options = node.arguments[0]
          if (options && options.type ==='Identifier') {

          } */
        }

        return false
      }
    })

    // New Import Declaration to inject
    const imports = [`import ${options.moduleName}Routes from '@/router/${options.moduleName}'`]

    // Inject new Import Declaration
    const toImport = i => recast.parse(`${i}\n`).program.body[0]
    const importDeclarations = []

    recast.types.visit(ast, {
      visitImportDeclaration({
        node
      }) {
        lastImportIndex = ast.program.body.findIndex(n => n === node)
        importDeclarations.push(node)
        return false
      }
    })
    delete ast.program.body[lastImportIndex].loc

    const newImport = imports.map(toImport)
    ast.program.body.splice(lastImportIndex + 1, 0, ...newImport)

    // write code injections to file
    fs.writeFile(`${routerRootFile}`, recast.print(ast).code, (err) => {
      if (err) {
        api.exitLog('Error writing to router root index.js: ' + err, 'error')
        return
      }
    })

    // Remove router.js generated from initial router plugin installation
    if (fs.existsSync('./src/router.js')) {
      fs.unlink('./src/router.js', (err) => {
        if (err) {
          api.exitLog('Failed to delete router.js file generated by router plugin: ' + err, 'warn')
        } else {
          api.exitLog('Successfully deleted router.js file generated by router plugin', 'done')
        }
      })
    }
  })
}