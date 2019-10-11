import { SourceFile, ImportDeclaration } from 'ts-morph'

function * getInlineDeclarations (sourceFile: SourceFile) {
    for (const decl of sourceFile.getImportDeclarations()) {
        if (shouldInline(decl)) yield decl
    }
}

export function * getInlineDependencies (sourceFile: SourceFile) {
    for (const decl of getInlineDeclarations(sourceFile)) yield decl.getModuleSpecifierSourceFile()
}

export function * getInlineDependencyLiterals (sourceFile: SourceFile) {
    for (const decl of getInlineDeclarations(sourceFile)) yield decl.getModuleSpecifierValue()
}

export function getDependenciesRecursively (sourceFile: SourceFile, result = new Map()) {
    result.set(sourceFile.getFilePath(), sourceFile)
    for (const dep of getInlineDependencies(sourceFile)) {
        if (result.has(dep.getFilePath())) continue
        getDependenciesRecursively(dep, result)
    }
    return result
}

export function shouldInline (decl: ImportDeclaration) {
    return isRelativePath(decl.getModuleSpecifierValue()) && !decl.getModuleSpecifierSourceFile().isDeclarationFile()
}

export function isRelativePath (importLiteralValue: string) {
    return /^\.\//.test(importLiteralValue)
}