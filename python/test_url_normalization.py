#!/usr/bin/env python3
import os
import sys

def test_url_normalization():
    tests_passed = 0
    tests_failed = 0
    
    print("Testing Database URL Normalization")
    print("=" * 50)
    
    test_cases = [
        ("postgres://testuser:testpass@localhost/testdb", "postgresql://testuser:testpass@localhost/testdb"),
        ("postgresql://testuser:testpass@localhost/testdb", "postgresql://testuser:testpass@localhost/testdb"),
        ("sqlite:///test.db", "sqlite:///test.db"),
    ]
    
    for input_url, expected_url in test_cases:
        os.environ['DATABASE_URL'] = input_url
        
        if 'db' in sys.modules:
            del sys.modules['db']
        
        import db
        
        actual_url = db.DB_URL
        
        if actual_url == expected_url:
            print(f"✓ PASS: {input_url[:30]}...")
            print(f"  Expected: {expected_url}")
            print(f"  Got:      {actual_url}")
            tests_passed += 1
        else:
            print(f"✗ FAIL: {input_url[:30]}...")
            print(f"  Expected: {expected_url}")
            print(f"  Got:      {actual_url}")
            tests_failed += 1
        print()
    
    print("=" * 50)
    print(f"Tests Passed: {tests_passed}")
    print(f"Tests Failed: {tests_failed}")
    
    return tests_failed == 0

if __name__ == "__main__":
    success = test_url_normalization()
    sys.exit(0 if success else 1)
