cmake_minimum_required(VERSION 3.6)

include(ExternalProject)
find_package(Git REQUIRED)

# depot_tools
# -----------------------------------------------------------------------------

ExternalProject_Add(
  project_depot_tools

  GIT_REPOSITORY    https://chromium.googlesource.com/chromium/tools/depot_tools.git
  GIT_TAG           2fddb95698211db1373ebe2b16091a54eac51c9c

  PREFIX            ${CMAKE_BINARY_DIR}/external/depot_tools/prefix
  TMP_DIR           ${CMAKE_BINARY_DIR}/external/depot_tools/tmp
  STAMP_DIR         ${CMAKE_BINARY_DIR}/external/depot_tools/stamp
  DOWNLOAD_DIR      ${CMAKE_BINARY_DIR}/external/depot_tools/download
  SOURCE_DIR        ${CMAKE_BINARY_DIR}/external/depot_tools/src
  BINARY_DIR        ${CMAKE_BINARY_DIR}/external/depot_tools/build

  CONFIGURE_COMMAND ""
  BUILD_COMMAND     ""
  INSTALL_COMMAND   ""
)

ExternalProject_Get_Property(project_depot_tools SOURCE_DIR)
set(depot_tools_install_dir ${SOURCE_DIR})

add_executable(cipd IMPORTED)
set_property(TARGET cipd PROPERTY IMPORTED_LOCATION ${depot_tools_install_dir}/cipd)
add_dependencies(cipd project_depot_tools)

add_executable(fetch IMPORTED)
set_property(TARGET fetch PROPERTY IMPORTED_LOCATION ${depot_tools_install_dir}/fetch)
add_dependencies(fetch project_depot_tools)

add_executable(gclient IMPORTED)
set_property(TARGET gclient PROPERTY IMPORTED_LOCATION ${depot_tools_install_dir}/gclient)
add_dependencies(gclient project_depot_tools)

add_executable(gn IMPORTED)
set_property(TARGET gn PROPERTY IMPORTED_LOCATION ${depot_tools_install_dir}/gn)
add_dependencies(gn project_depot_tools)

add_executable(ninja IMPORTED)
set_property(TARGET ninja PROPERTY IMPORTED_LOCATION ${depot_tools_install_dir}/ninja)
add_dependencies(ninja project_depot_tools)

# libwebrtc
# -----------------------------------------------------------------------------

set(GN_GEN_ARGS use_sysroot=false)
if (CMAKE_BUILD_TYPE STREQUAL "Debug")
  list(APPEND GN_GEN_ARGS is_debug=true)
else()
  list(APPEND GN_GEN_ARGS is_debug=false)
endif()

if (APPLE)
  set(nohooks false)
elseif(UNIX)
  set(nohooks true)
  list(APPEND GN_GEN_ARGS is_clang=false use_custom_libcxx=false use_gold=false use_sysroot=false treat_warnings_as_errors=false)
endif()

string (REPLACE ";" " " GN_GEN_ARGS_STR "${GN_GEN_ARGS}")

set(WEBRTC_REVISION d34a1886495b63c79c2ce08cf00be40eef554ebf)

ExternalProject_Add(
  project_libwebrtc

  PREFIX            ${CMAKE_BINARY_DIR}/external/libwebrtc/prefix
  TMP_DIR           ${CMAKE_BINARY_DIR}/external/libwebrtc/tmp
  STAMP_DIR         ${CMAKE_BINARY_DIR}/external/libwebrtc/stamp
  DOWNLOAD_DIR      ${CMAKE_BINARY_DIR}/external/libwebrtc/download
  SOURCE_DIR        ${CMAKE_BINARY_DIR}/external/libwebrtc/download/src
  BINARY_DIR        ${CMAKE_BINARY_DIR}/external/libwebrtc/build/${CMAKE_BUILD_TYPE}

  DOWNLOAD_COMMAND  ${CMAKE_COMMAND} -E env NOHOOKS=${nohooks} PATH=${depot_tools_install_dir}:$ENV{PATH} WEBRTC_REVISION=${WEBRTC_REVISION} ${CMAKE_SOURCE_DIR}/scripts/download-webrtc.sh
  PATCH_COMMAND     ${CMAKE_COMMAND} -E env CMAKE_SOURCE_DIR=${CMAKE_SOURCE_DIR} ${CMAKE_SOURCE_DIR}/scripts/patch-webrtc.sh
  CONFIGURE_COMMAND ${CMAKE_COMMAND} -E env BINARY_DIR=<BINARY_DIR> GN_GEN_ARGS=${GN_GEN_ARGS_STR} PATH=${depot_tools_install_dir}:$ENV{PATH} SOURCE_DIR=<SOURCE_DIR> ${CMAKE_SOURCE_DIR}/scripts/configure-webrtc.sh
  BUILD_COMMAND     ${CMAKE_COMMAND} -E env CMAKE_BUILD_TYPE=${CMAKE_BUILD_TYPE} PATH=${depot_tools_install_dir}:$ENV{PATH} ${CMAKE_SOURCE_DIR}/scripts/build-webrtc.sh
  INSTALL_COMMAND   ""
)

# add_dependencies(project_libwebrtc cipd)
add_dependencies(project_libwebrtc fetch)
# add_dependencies(project_libwebrtc gclient)
# add_dependencies(project_libwebrtc gn)
# add_dependencies(project_libwebrtc ninja)

ExternalProject_Get_Property(project_libwebrtc DOWNLOAD_DIR)
set(libwebrtc_source_dir "${DOWNLOAD_DIR}")

ExternalProject_Get_Property(project_libwebrtc BINARY_DIR)
set(libwebrtc_binary_dir "${BINARY_DIR}")

add_library(libwebrtc STATIC IMPORTED)
add_dependencies(libwebrtc project_libwebrtc)
if(WIN32)
  set_property(TARGET libwebrtc PROPERTY IMPORTED_IMPLIB "${libwebrtc_binary_dir}/obj/libwebrtc.lib")
else()
  set_property(TARGET libwebrtc PROPERTY IMPORTED_LOCATION "${libwebrtc_binary_dir}/obj/libwebrtc.a")
endif()

set(MODULE wrtc)
include(${CMAKE_SOURCE_DIR}/NodeJS.cmake)
nodejs_init()

file(GLOB_RECURSE MODULE_SRC src/*.cc src/*.h)
add_nodejs_module(${MODULE} ${MODULE_SRC})

file(GLOB_RECURSE MODULE_SRC_WITHOUT_WEBRTC src/*.cc src/*.h)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  target_compile_definitions(${MODULE} PRIVATE -DDEBUG)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g")
endif()

target_include_directories(${MODULE} PRIVATE ${CMAKE_SOURCE_DIR})

find_package(Threads)

target_include_directories(${MODULE} SYSTEM PRIVATE
  ${libwebrtc_source_dir}
  ${libwebrtc_source_dir}/webrtc
  ${libwebrtc_source_dir}/webrtc/third_party/abseil-cpp)

if(WIN32)
  set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /MT /GR-")
  set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /MTd /GR-")

  target_link_libraries(${MODULE} PRIVATE
    ${CMAKE_THREAD_LIBS_INIT}
    dmoguids.lib
    msdmo.lib
    secur32.lib
    winmm.lib
    wmcodecdspuuid.lib
    ws2_32.lib)

  target_compile_definitions(${MODULE} PRIVATE
    -DINCL_EXTRA_HTON_FUNCTIONS
    -DWEBRTC_WIN
    -DNOGDI
    -DNOMINMAX)
else()
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-rtti")

  target_link_libraries(${MODULE} PRIVATE
    ${CMAKE_THREAD_LIBS_INIT}
    libwebrtc)

  target_compile_options(${MODULE} PUBLIC
    # -Werror
    -Wall
    -Wpedantic
    -Wno-missing-field-initializers
    -Wextra
    -Wno-unused-local-typedefs
    -Wno-uninitialized
    -Wno-unused-variable)
endif()

if(APPLE)
  target_compile_definitions(${MODULE} PRIVATE
    -DWEBRTC_MAC
    -DWEBRTC_IOS
    -DWEBRTC_POSIX=1)

  target_link_libraries(${MODULE} PRIVATE
    "-framework AppKit"
    "-framework AVFoundation")
elseif(UNIX)
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fpermissive")
  target_compile_definitions(${MODULE} PRIVATE
    -DWEBRTC_LINUX
    -DWEBRTC_POSIX=1)
  if (CMAKE_BUILD_TYPE STREQUAL "Debug")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -D_GLIBCXX_DEBUG=1")
  endif()
endif()

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  list(APPEND ASTYLE_CMAKE_ARGS
    "-DCMAKE_INSTALL_PREFIX=${CMAKE_BINARY_DIR}")

  ExternalProject_Add(
    astyle
    GIT_REPOSITORY      https://github.com/Bareflank/astyle.git
    GIT_TAG             v1.2
    GIT_SHALLOW         true
    CMAKE_ARGS          ${ASTYLE_CMAKE_ARGS}
    PREFIX              ${CMAKE_BINARY_DIR}/external/astyle/prefix
    TMP_DIR             ${CMAKE_BINARY_DIR}/external/astyle/tmp
    STAMP_DIR           ${CMAKE_BINARY_DIR}/external/astyle/stamp
    DOWNLOAD_DIR        ${CMAKE_BINARY_DIR}/external/astyle/download
    SOURCE_DIR          ${CMAKE_BINARY_DIR}/external/astyle/src
    BINARY_DIR          ${CMAKE_BINARY_DIR}/external/astyle/build)

  list(APPEND ASTYLE_ARGS
    --style=google
    --lineend=linux
    --suffix=none
    --pad-oper
    --unpad-paren
    --align-pointer=type
    --align-reference=type
    --indent-preproc-define
    --indent-switches
    --indent-col1-comments
    --keep-one-line-statements
    --keep-one-line-blocks
    --pad-header
    --convert-tabs
    --min-conditional-indent=0
    --indent=spaces=2
    --indent-continuation=2
    --indent-after-parens
    --close-templates
    --add-brackets
    --break-after-logical
    ${MODULE_SRC_WITHOUT_WEBRTC})

  if(NOT WIN32 STREQUAL "1")
    add_custom_target(
      format
      COMMAND ${CMAKE_BINARY_DIR}/bin/astyle ${ASTYLE_ARGS}
      COMMENT "running astyle")
  else()
    add_custom_target(
      format
      COMMAND ${CMAKE_BINARY_DIR}/bin/astyle.exe ${ASTYLE_ARGS}
      COMMENT "running astyle")
  endif()

  list(APPEND CPPCHECK_CMAKE_ARGS
    "-DCMAKE_INSTALL_PREFIX=${CMAKE_BINARY_DIR}")

  ExternalProject_Add(
    cppcheck
    GIT_REPOSITORY      https://github.com/danmar/cppcheck.git
    GIT_TAG             1.83
    GIT_SHALLOW         true
    CMAKE_ARGS          ${CPPCHECK_CMAKE_ARGS}
    PREFIX              ${CMAKE_BINARY_DIR}/external/cppcheck/prefix
    TMP_DIR             ${CMAKE_BINARY_DIR}/external/cppcheck/tmp
    STAMP_DIR           ${CMAKE_BINARY_DIR}/external/cppcheck/stamp
    DOWNLOAD_DIR        ${CMAKE_BINARY_DIR}/external/cppcheck/download
    SOURCE_DIR          ${CMAKE_BINARY_DIR}/external/cppcheck/src
    BINARY_DIR          ${CMAKE_BINARY_DIR}/external/cppcheck/build)

  list(APPEND CPPCHECK_ARGS
    --enable=warning,style,performance,portability,unusedFunction
    --std=c++11
    --verbose
    --error-exitcode=1
    --language=c++
    -i${CMAKE_SOURCE_DIR}/src/webrtc
    ${CMAKE_SOURCE_DIR}/src/*.cc)

  add_custom_target(
    check
    COMMAND ${CMAKE_BINARY_DIR}/bin/cppcheck ${CPPCHECK_ARGS}
    COMMENT "running cppcheck")
endif()
