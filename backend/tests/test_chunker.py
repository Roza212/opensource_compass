import pytest
from app.utils.chunker import chunk_code

def test_python_chunking():
    source = "def hello():\n    print('world')\n\nclass MyClass:\n    pass"
    chunks = chunk_code("test.py", source)
    assert len(chunks) >= 2
    assert any(c['chunk_type'] == 'function_definition' for c in chunks)
    assert any(c['chunk_type'] == 'class_definition' for c in chunks)
    assert chunks[0]['language'] == 'python'

def test_javascript_chunking():
    source = "function hello() { console.log('world'); }\nclass MyClass {}"
    chunks = chunk_code("test.js", source)
    assert len(chunks) >= 2
    assert any(c['chunk_type'] == 'function_declaration' for c in chunks)
    assert any(c['chunk_type'] == 'class_declaration' for c in chunks)
    assert chunks[0]['language'] == 'javascript'

def test_go_chunking():
    source = "package main\nfunc Hello() {\n    fmt.Println(\"world\")\n}\ntype User struct {}"
    chunks = chunk_code("test.go", source)
    assert len(chunks) >= 2
    assert any(c['chunk_type'] == 'function_declaration' for c in chunks)
    assert any(c['chunk_type'] == 'type_declaration' for c in chunks)
    assert chunks[0]['language'] == 'go'

def test_rust_chunking():
    source = "fn hello() { println!(\"world\"); }\nstruct User {}"
    chunks = chunk_code("test.rs", source)
    assert len(chunks) >= 2
    assert any(c['chunk_type'] == 'function_item' for c in chunks)
    assert any(c['chunk_type'] == 'struct_item' for c in chunks)
    assert chunks[0]['language'] == 'rust'

def test_fallback_chunking():
    source = "# Header\n\nSome text here.\n\nMore text."
    chunks = chunk_code("test.md", source)
    assert len(chunks) >= 1
    assert chunks[0]['chunk_type'] == 'line_block'
    assert chunks[0]['language'] == 'markdown'

def test_java_chunking():
    source = "public class Hello {\n    public void say() {}\n}"
    chunks = chunk_code("Hello.java", source)
    assert len(chunks) >= 1
    assert any(c['chunk_type'] == 'class_declaration' for c in chunks)
    assert chunks[0]['language'] == 'java'

def test_ruby_chunking():
    source = "def hello\n  puts 'world'\nend\nclass MyClass\nend"
    chunks = chunk_code("test.rb", source)
    assert len(chunks) >= 2
    assert any(c['chunk_type'] == 'method' for c in chunks)
    assert any(c['chunk_type'] == 'class' for c in chunks)
    assert chunks[0]['language'] == 'ruby'
